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

/**
 * The SSE fetch reads `res.body.getReader()`; an immediately-closing stream
 * ends the read loop cleanly, so the mount effect settles without an error
 * or a 3s reconnect timer left dangling.
 */
function closedEventStreamResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body,
    json: async () => ({}),
  } as unknown as Response;
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

/** An SSE response the test drives frame by frame. */
function controllableEventStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
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
    emit(type: string, data: unknown) {
      controller.enqueue(
        encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    },
    close() {
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

  beforeEach(() => {
    calls = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/session/events")) return closedEventStreamResponse();
      if (url.includes("/messages") && methodOf(init) === "POST")
        return jsonResponse({});
      if (url.includes("/messages")) return jsonResponse([]); // GET history
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
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
});

describe("useSessionStream local echo", () => {
  let history: unknown[];
  let stream: ReturnType<typeof controllableEventStream>;
  let postFails: boolean;
  let historyGate: Promise<void> | null;

  beforeEach(() => {
    history = [];
    postFails = false;
    historyGate = null;
    stream = controllableEventStream();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/session/events")) {
        // A stream body reads once, so every (re)connect gets a fresh one;
        // `stream` tracks the newest so `emit` targets the live connection.
        stream = controllableEventStream();
        return stream.response;
      }
      if (url.includes("/messages") && methodOf(init) === "POST") {
        return postFails
          ? jsonResponse({}, false, 500)
          : jsonResponse({ userMessageId: "msg-user" });
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
    stream.close();
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
      await result.current.send("never lands");
    });

    expect(userTexts(result.current)).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain("500");
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
});
