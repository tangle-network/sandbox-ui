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
