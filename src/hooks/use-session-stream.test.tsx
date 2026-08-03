import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSessionStream } from "./use-session-stream";

type Call = { url: string; init?: RequestInit };

/** Decode a wire text part the way the sidecar does, to assert the round-trip. */
function decodeWire(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: "OK",
    json: async () => payload,
    body: null,
  } as unknown as Response;
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

/** An SSE response the test drives frame by frame. */
function controllableEventStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: {
      ok: true,
      status: 200,
      statusText: "OK",
      body,
      json: async () => ({}),
    } as unknown as Response,
    emit(type: string, data: unknown, id?: string) {
      controller.enqueue(
        encoder.encode(
          `${id ? `id: ${id}\n` : ""}event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
        ),
      );
    },
    push(raw: string) {
      controller.enqueue(encoder.encode(raw));
    },
    close() {
      if (closed) return;
      closed = true;
      controller.close();
    },
  };
}

/** A history entry in the shape `GET /session/sessions/{id}/messages` returns. */
function historyMessage(
  id: string,
  role: "user" | "assistant",
  text: string,
): unknown {
  return {
    info: { id, role, timestamp: new Date(0).toISOString() },
    parts: [{ type: "text", text }],
  };
}

describe("useSessionStream send()", () => {
  let calls: Call[];
  let stream: ReturnType<typeof controllableEventStream>;

  beforeEach(() => {
    calls = [];
    stream = controllableEventStream();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/session/events")) return stream.response;
      if (url.includes("/messages") && methodOf(init) === "POST")
        return jsonResponse({});
      if (url.includes("/messages")) return jsonResponse([]); // GET history
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    stream.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function postTo(sessionId: string): Call | undefined {
    return calls.find(
      (c) =>
        c.url.endsWith(`/${sessionId}/messages`) && methodOf(c.init) === "POST",
    );
  }

  it("base64-encodes the text part on the wire (regression: #183 sent raw UTF-8 → 400)", async () => {
    const { result } = renderHook(() =>
      useSessionStream({
        apiUrl: "http://sidecar.test",
        token: "tok",
        sessionId: "sess-1",
      }),
    );
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.send("ping test");
    });

    const post = postTo("sess-1");
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post?.init?.body));
    expect(body.parts).toHaveLength(1);
    expect(body.parts[0].type).toBe("text");
    // The literal text must NOT go on the wire — that was the bug.
    expect(body.parts[0].text).not.toBe("ping test");
    // And it must decode back to exactly what the user typed (what the sidecar does).
    expect(decodeWire(body.parts[0].text)).toBe("ping test");
  });

  it("forwards per-turn overrides alongside the encoded text", async () => {
    const { result } = renderHook(() =>
      useSessionStream({
        apiUrl: "http://sidecar.test",
        token: "tok",
        sessionId: "sess-2",
      }),
    );
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.send("hello world", {
        model: { providerID: "openai-compat", modelID: "openai/gpt-5-chat" },
        agent: "build",
        system: "be terse",
      });
    });

    const body = JSON.parse(String(postTo("sess-2")?.init?.body));
    expect(decodeWire(body.parts[0].text)).toBe("hello world");
    expect(body.model).toEqual({
      providerID: "openai-compat",
      modelID: "openai/gpt-5-chat",
    });
    expect(body.agent).toBe("build");
    expect(body.system).toBe("be terse");
  });

  it("rejects instead of silently discarding a message before chat is ready", async () => {
    const { result } = renderHook(() =>
      useSessionStream({
        apiUrl: "http://sidecar.test",
        token: null,
        sessionId: "sess-not-ready",
      }),
    );

    await expect(result.current.send("do not lose this")).rejects.toMatchObject({
      code: "CHAT_NOT_READY",
    });
    expect(postTo("sess-not-ready")).toBeUndefined();
  });
});

describe("useSessionStream local echo", () => {
  let history: unknown[];
  let stream: ReturnType<typeof controllableEventStream>;
  let openStreams: ReturnType<typeof controllableEventStream>[];
  let postFails: boolean;
  let postErrorPayload: unknown;
  let historyGate: Promise<void> | null;
  let eventRequestInits: RequestInit[];
  let eventRequestUrls: string[];

  beforeEach(() => {
    history = [];
    postFails = false;
    postErrorPayload = {};
    historyGate = null;
    eventRequestInits = [];
    eventRequestUrls = [];
    openStreams = [];
    stream = controllableEventStream();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/session/events")) {
        eventRequestUrls.push(url);
        eventRequestInits.push(init ?? {});
        // A stream body reads once, so every (re)connect gets a fresh one;
        // `stream` tracks the newest so `emit` targets the live connection,
        // and every one is kept so teardown can close them all.
        stream = controllableEventStream();
        openStreams.push(stream);
        return stream.response;
      }
      if (url.includes("/messages") && methodOf(init) === "POST") {
        return postFails
          ? jsonResponse(postErrorPayload, false, 500)
          : jsonResponse({
              info: { id: "execution-1" },
              userMessageId: "msg-user",
            });
      }
      if (url.includes("/messages")) {
        if (historyGate) await historyGate;
        return jsonResponse(history);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    for (const open of openStreams) open.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Hold every subsequent history GET; returns the release. */
  function holdHistory(): () => void {
    let release!: () => void;
    historyGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      historyGate = null;
      release();
    };
  }

  type Streamed = ReturnType<typeof useSessionStream>;

  /** The rendered text of every user message, in transcript order. */
  function userTexts(current: Streamed): string[] {
    return current.messages
      .filter((message) => message.role === "user")
      .map((message) =>
        (current.partMap[message.id] ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(""),
      );
  }

  async function mounted(sessionId: string) {
    const rendered = renderHook(() =>
      useSessionStream({
        apiUrl: "http://sidecar.test",
        token: "tok",
        sessionId,
      }),
    );
    await waitFor(() => expect(rendered.result.current.connected).toBe(true));
    return rendered;
  }

  it("renders the sender's message before the agent answers (regression: #4354 showed it only after the reply)", async () => {
    const { result } = await mounted("sess-echo");

    await act(async () => {
      await result.current.send("what does this repo do?");
    });

    // No `session.idle`, no history refetch — only the send has happened.
    expect(userTexts(result.current)).toEqual(["what does this repo do?"]);
    expect(result.current.isStreaming).toBe(true);
  });

  it("replaces the echo with the backend's copy once the turn goes idle", async () => {
    const { result } = await mounted("sess-idle");

    await act(async () => {
      await result.current.send("hello");
    });
    expect(userTexts(result.current)).toEqual(["hello"]);

    history = [
      historyMessage("msg-1", "user", "hello"),
      historyMessage("msg-2", "assistant", "hi there"),
    ];
    await act(async () => {
      stream.emit("session.idle", { properties: { sessionID: "sess-idle" } });
    });

    // Exactly one user message: the canonical one, not the echo beside it.
    await waitFor(() => expect(userTexts(result.current)).toEqual(["hello"]));
    expect(result.current.messages.map((message) => message.id)).toEqual([
      "msg-1",
      "msg-2",
    ]);
    expect(result.current.isStreaming).toBe(false);
  });

  it("keeps a message sent while the previous turn's refetch is still in flight", async () => {
    const { result } = await mounted("sess-race");

    history = [historyMessage("msg-1", "user", "first")];
    const releaseHistory = holdHistory();
    await act(async () => {
      stream.emit("session.idle", { properties: { sessionID: "sess-race" } });
    });

    // The composer unlocks on idle, so the next message can be sent before the
    // refetch it triggered has come back.
    await act(async () => {
      await result.current.send("second");
    });
    await act(async () => {
      releaseHistory();
    });

    await waitFor(() =>
      expect(userTexts(result.current)).toEqual(["first", "second"]),
    );
  });

  it("drops the echo and releases the composer when the send is rejected", async () => {
    const { result } = await mounted("sess-fail");
    postFails = true;

    await act(async () => {
      await expect(result.current.send("never lands")).rejects.toMatchObject({
        code: "HTTP_500",
      });
    });

    expect(userTexts(result.current)).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain("500");
  });

  it("rejects a concurrent send before issuing a second request", async () => {
    const { result } = await mounted("sess-concurrent");

    await act(async () => {
      await result.current.send("the real turn");
    });
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      await expect(result.current.send("fires mid-run")).rejects.toMatchObject({
        code: "CHAT_BUSY",
      });
    });

    expect(userTexts(result.current)).toEqual(["the real turn"]);
    expect(result.current.isStreaming).toBe(true);
  });

  it("rejects a send while a detached run is streaming", async () => {
    const { result } = await mounted("sess-detached");

    // An assistant is already streaming into this session without any echo of
    // its own — a run this client did not start.
    await act(async () => {
      stream.emit("message.updated", {
        properties: { info: { id: "msg-detached", role: "assistant" } },
      });
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    await act(async () => {
      await expect(
        result.current.send("fires during the detached run"),
      ).rejects.toMatchObject({ code: "CHAT_BUSY" });
    });

    expect(userTexts(result.current)).toEqual([]);
    expect(result.current.isStreaming).toBe(true);
  });

  it("does not carry an echo into a different session's transcript", async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useSessionStream({
          apiUrl: "http://sidecar.test",
          token: "tok",
          sessionId,
        }),
      { initialProps: { sessionId: "sess-a" } },
    );
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.send("meant for sess-a");
    });
    expect(userTexts(result.current)).toEqual(["meant for sess-a"]);

    history = [historyMessage("msg-b", "user", "already in sess-b")];
    await act(async () => {
      rerender({ sessionId: "sess-b" });
    });

    await waitFor(() =>
      expect(userTexts(result.current)).toEqual(["already in sess-b"]),
    );
  });

  it("strands no echo when the session changes with the stream disabled", async () => {
    const { result, rerender } = renderHook(
      (props: { sessionId: string; enabled: boolean }) =>
        useSessionStream({
          apiUrl: "http://sidecar.test",
          token: "tok",
          ...props,
        }),
      { initialProps: { sessionId: "sess-a", enabled: true } },
    );
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.send("meant for sess-a");
    });
    expect(userTexts(result.current)).toEqual(["meant for sess-a"]);

    // Disabled, so nothing refetches on the way out of sess-a — the echo is
    // stranded unless the session change itself drops it.
    await act(async () => {
      rerender({ sessionId: "sess-b", enabled: false });
    });

    // Back on sess-a, whose history now holds the canonical copy. A surviving
    // echo would match this session again and render the message twice.
    history = [historyMessage("msg-a", "user", "meant for sess-a")];
    await act(async () => {
      rerender({ sessionId: "sess-a", enabled: true });
    });

    await waitFor(() =>
      expect(userTexts(result.current)).toEqual(["meant for sess-a"]),
    );
  });

  it("uses a part's message id when output arrives before message.updated", async () => {
    const { result } = await mounted("sess-part-first");

    await act(async () => {
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-1",
            messageID: "assistant-1",
            type: "text",
            text: "hel",
          },
        },
      });
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "assistant-1", role: "assistant" }),
      ]),
    );
    expect(result.current.partMap["assistant-1"]).toEqual([
      { type: "text", text: "hel" },
    ]);

    await act(async () => {
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-1",
            messageID: "assistant-1",
            type: "text",
            text: "hello",
          },
        },
      });
    });

    expect(result.current.partMap["assistant-1"]).toEqual([
      { type: "text", text: "hello" },
    ]);
  });

  it("parses CRLF, multiline data, and chunks split inside an event", async () => {
    const { result } = await mounted("sess-chunked");

    await act(async () => {
      stream.push("event: message.part.updated\r\ndata: {\"properties\":{\r\n");
      stream.push(
        "data: \"part\":{\"id\":\"part-2\",\"messageID\":\"assistant-2\",\"type\":\"text\",\"text\":\"chunked\"}}}\r\n\r\n",
      );
    });

    await waitFor(() =>
      expect(result.current.partMap["assistant-2"]).toEqual([
        { type: "text", text: "chunked" },
      ]),
    );
  });

  it("shows a nested session error with its stable code", async () => {
    const { result } = await mounted("sess-error");

    await act(async () => {
      stream.emit("session.error", {
        properties: {
          error: {
            code: "MODEL_AUTH_FAILED",
            message: "The model credential was rejected.",
          },
        },
      });
    });

    expect(result.current.error).toBe(
      "The model credential was rejected. (MODEL_AUTH_FAILED)",
    );
    expect(result.current.isStreaming).toBe(false);
  });

  it("reconnects a cleanly closed stream and resumes after its last event id", async () => {
    const { result } = await mounted("sess-reconnect");

    await act(async () => {
      stream.emit(
        "message.updated",
        { properties: { info: { id: "assistant-3", role: "assistant" } } },
        "event-42",
      );
    });
    stream.close();

    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(result.current.error).toContain("Reconnecting");
    await waitFor(() => expect(openStreams).toHaveLength(2), {
      timeout: 2500,
    });

    const reconnectUrl = new URL(eventRequestUrls[1]);
    expect(reconnectUrl.searchParams.get("executionId")).toBe("assistant-3");
    expect(reconnectUrl.searchParams.get("since")).toBe("event-42");
    expect(eventRequestInits[1]?.headers).not.toHaveProperty("Last-Event-ID");
  });

  it("uses the admission receipt for replay when disconnect happens before output", async () => {
    const { result } = await mounted("sess-receipt-replay");

    await act(async () => {
      await result.current.send("start the turn");
    });
    stream.close();

    await waitFor(() => expect(openStreams).toHaveLength(2), {
      timeout: 2500,
    });
    const reconnectUrl = new URL(eventRequestUrls[1]);
    expect(reconnectUrl.searchParams.get("executionId")).toBe("execution-1");
  });

  it("requests full replay for every active execution after a disconnect", async () => {
    const { result } = await mounted("sess-multi-replay");

    await act(async () => {
      stream.emit(
        "message.part.updated",
        {
          properties: {
            part: {
              id: "part-a",
              messageID: "assistant-a",
              type: "text",
              text: "first",
            },
          },
        },
        "event-a",
      );
      stream.emit(
        "message.part.updated",
        {
          properties: {
            part: {
              id: "part-b",
              messageID: "assistant-b",
              type: "text",
              text: "second",
            },
          },
        },
        "event-b",
      );
    });
    stream.close();

    await waitFor(() => expect(openStreams).toHaveLength(2), {
      timeout: 2500,
    });
    const reconnectUrl = new URL(eventRequestUrls[1]);
    expect(reconnectUrl.searchParams.get("executionId")).toBeNull();
    expect(reconnectUrl.searchParams.get("replayExecutionIds")).toBe(
      "assistant-a,assistant-b",
    );
    expect(reconnectUrl.searchParams.get("since")).toBe("event-b");
  });

  it("keeps another assistant turn streaming when one execution goes idle", async () => {
    const { result } = await mounted("sess-overlap");

    await act(async () => {
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-a",
            messageID: "assistant-a",
            type: "text",
            text: "first",
          },
        },
      });
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-b",
            messageID: "assistant-b",
            type: "text",
            text: "sec",
          },
        },
      });
    });

    await act(async () => {
      stream.emit("session.idle", {
        properties: { executionId: "assistant-a" },
      });
    });
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-b",
            messageID: "assistant-b",
            type: "text",
            text: "second",
          },
        },
      });
    });

    expect(result.current.partMap["assistant-b"]).toEqual([
      { type: "text", text: "second" },
    ]);
    expect(result.current.isStreaming).toBe(true);
  });

  it("keeps another assistant turn streaming when one execution fails", async () => {
    const { result } = await mounted("sess-overlap-error");

    await act(async () => {
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-a",
            messageID: "assistant-a",
            type: "text",
            text: "first",
          },
        },
      });
      stream.emit("message.part.updated", {
        properties: {
          part: {
            id: "part-b",
            messageID: "assistant-b",
            type: "text",
            text: "second",
          },
        },
      });
      stream.emit("session.error", {
        properties: {
          executionId: "assistant-a",
          error: { code: "MODEL_ERROR", message: "First turn failed." },
        },
      });
    });

    expect(result.current.error).toBe("First turn failed. (MODEL_ERROR)");
    expect(result.current.isStreaming).toBe(true);
  });

  it("does not terminate concurrent turns on an unattributed error", async () => {
    const { result } = await mounted("sess-unattributed-error");

    await act(async () => {
      stream.emit("message.updated", {
        properties: { info: { id: "assistant-a", role: "assistant" } },
      });
      stream.emit("message.updated", {
        properties: { info: { id: "assistant-b", role: "assistant" } },
      });
      stream.emit("session.error", {
        properties: {
          error: { code: "UNKNOWN_RUN", message: "A turn failed." },
        },
      });
    });

    expect(result.current.error).toBe("A turn failed. (UNKNOWN_RUN)");
    expect(result.current.isStreaming).toBe(true);
  });

  it("removes a local echo once history contains its acknowledged id", async () => {
    const { result } = await mounted("sess-reconcile");

    await act(async () => {
      await result.current.send("one copy only");
    });
    history = [historyMessage("msg-user", "user", "one copy only")];
    await act(async () => {
      await result.current.refetch();
    });

    expect(userTexts(result.current)).toEqual(["one copy only"]);
    expect(result.current.messages.map((message) => message.id)).toEqual([
      "msg-user",
    ]);
  });

  it("surfaces the API's nested rejection and returns it to the caller", async () => {
    const { result } = await mounted("sess-api-error");
    postFails = true;
    postErrorPayload = {
      error: {
        code: "SESSION_CAPACITY_EXHAUSTED",
        message: "No session slot is available.",
      },
    };

    await act(async () => {
      await expect(result.current.send("hello")).rejects.toMatchObject({
        code: "SESSION_CAPACITY_EXHAUSTED",
        status: 500,
      });
    });
    expect(result.current.error).toBe(
      "No session slot is available. (SESSION_CAPACITY_EXHAUSTED)",
    );
  });
});
