import type { AgentInteractiveSessionControlClaim } from "@tangle-network/agent-interface"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { usePtySession } from "./use-pty-session"

/**
 * Integration tests for the input-serialization contract.
 *
 * Covers issue #802 in the agent-dev-container repo: sandbox terminal
 * input was laggy (>1s) and arrived at the sidecar out of order because
 * `sendCommand` previously issued one concurrent `fetch` per keystroke.
 * These tests lock in the invariants that prevent regressions:
 *
 *   1. At most one POST /terminals/:id/input is in flight at a time.
 *   2. Keystrokes enqueued during an in-flight request are coalesced
 *      into the next request, in the order they were submitted.
 *   3. Every `sendCommand` promise resolves/rejects based on the
 *      outcome of the specific batch POST that carried its payload.
 */

interface MockResponse {
  ok: boolean
  status: number
  body: string
}

function mockResponse({ ok = true, status = 200, body = "" }: Partial<MockResponse>): Response {
  return {
    ok,
    status,
    text: async () => body,
    json: async () => (body ? JSON.parse(body) : {}),
    body: null,
  } as unknown as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const API_URL = "https://sidecar.local"
const fixtureValue = "test-token"
const SESSION_ID = "sess_abc"

interface FetchCall {
  url: string
  method: string
  body: string | null
}

interface PendingInput {
  call: FetchCall
  settle: (response: Response) => void
  reject: (err: unknown) => void
}

/**
 * Default WebSocket stub: construction succeeds but the connection
 * fails on the next microtask, so `connectWs` settles `false` quickly
 * and `connect` falls back to SSE+POST. Tests targeting the HTTP path
 * stay deterministic (no real handshake, no 1.5s timeout wait).
 */
function installFailFastWebSocketStub() {
  class FailingWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    readyState = 0
    binaryType: BinaryType = "blob"
    url: string
    onopen: ((ev: Event) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: ((ev: Event) => void) | null = null
    onclose: ((ev: CloseEvent) => void) | null = null
    // Accept (and ignore) the optional `protocols` arg. Real
    // browsers handle a single string OR an array; we don't care
    // here — tests for the SSE-fallback path don't probe
    // subprotocols. The argument is required to satisfy the
    // `new WebSocket(url, protocols)` call signature the hook
    // emits for the bearer-subprotocol auth path.
    constructor(url: string, _protocols?: string | string[]) {
      this.url = url
      queueMicrotask(() => {
        this.readyState = 3
        this.onclose?.({
          code: 1006,
          reason: "",
          wasClean: false,
        } as unknown as CloseEvent)
      })
    }
    send() {}
    close() {
      this.readyState = 3
    }
  }
  vi.stubGlobal("WebSocket", FailingWebSocket)
}

/**
 * Test handle for the openable WebSocket stub. Tests drive the socket
 * lifecycle explicitly (open, push messages, close) so they don't race
 * the event loop.
 */
interface FakeWsHandle {
  url: string
  /** Current socket state. */
  readonly readyState: number
  /** Subprotocols the hook offered (the bearer-auth subprotocol lives here). */
  protocols: string[]
  /** Frames sent by the hook as text (control messages). */
  sentText: string[]
  /** Frames sent by the hook as binary (stdin payloads), decoded UTF-8. */
  sentBinary: string[]
  /** Drive the open event. */
  open: () => void
  /** Push a TEXT frame from server → client. */
  pushMessage: (data: string) => void
  /** Push a BINARY frame from server → client (ArrayBuffer payload). */
  pushBinary: (data: ArrayBuffer) => void
  /** Push a BINARY frame as a Uint8Array view (exercises the ArrayBufferView decode path). */
  pushBinaryView: (data: ArrayBufferView) => void
  /** Push a Blob frame (exercises the Blob fallback decode path). */
  pushBlob: (data: Blob) => void
  /** Drive the close event. */
  close: (code?: number) => void
  /** Emit a delayed close event without changing the socket state. */
  emitClose: (code?: number) => void
}

/**
 * Openable WebSocket stub: tests drive the open / message / close
 * events explicitly. Used by the WS-transport tests below.
 */
function installOpeningWebSocketStub(
  options: { emitCloseOnClose?: boolean } = {},
): { handles: FakeWsHandle[] } {
  const handles: FakeWsHandle[] = []
  class OpeningWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    readyState = 0
    binaryType: BinaryType = "blob"
    url: string
    onopen: ((ev: Event) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: ((ev: Event) => void) | null = null
    onclose: ((ev: CloseEvent) => void) | null = null
    private sentText: string[] = []
    private sentBinary: string[] = []
    constructor(url: string, protocols?: string | string[]) {
      this.url = url
      const protocolList =
        protocols === undefined
          ? []
          : typeof protocols === "string"
            ? [protocols]
            : [...protocols]
      const self = this
      handles.push({
        url,
        get readyState() {
          return self.readyState
        },
        protocols: protocolList,
        sentText: this.sentText,
        sentBinary: this.sentBinary,
        open() {
          self.readyState = 1
          self.onopen?.({} as Event)
        },
        pushMessage(data: string) {
          self.onmessage?.({ data } as MessageEvent)
        },
        pushBinary(data: ArrayBuffer) {
          self.onmessage?.({ data } as MessageEvent)
        },
        pushBinaryView(data: ArrayBufferView) {
          self.onmessage?.({ data } as MessageEvent)
        },
        pushBlob(data: Blob) {
          self.onmessage?.({ data } as MessageEvent)
        },
        emitClose(code = 1000) {
          self.onclose?.({
            code,
            reason: "",
            wasClean: code === 1000,
          } as unknown as CloseEvent)
        },
        close(code = 1000) {
          self.readyState = 3
          if (options.emitCloseOnClose !== false) {
            this.emitClose(code)
          }
        },
      })
    }
    send(data: string | ArrayBuffer | ArrayBufferView | Blob) {
      if (typeof data === "string") {
        this.sentText.push(data)
      } else if (data instanceof ArrayBuffer) {
        this.sentBinary.push(new TextDecoder().decode(data))
      } else if (ArrayBuffer.isView(data)) {
        this.sentBinary.push(new TextDecoder().decode(data as ArrayBufferView))
      } else {
        // Blob — not used by the hook.
      }
    }
    close() {
      if (this.readyState === 3) return
      this.readyState = 3
      if (options.emitCloseOnClose !== false) {
        this.onclose?.({
          code: 1000,
          reason: "",
          wasClean: true,
        } as unknown as CloseEvent)
      }
    }
  }
  vi.stubGlobal("WebSocket", OpeningWebSocket)
  return { handles }
}

/** True when `body` is a string parsing to a JSON object — what a route
 *  declaring an object schema accepts. `null`/`undefined` are the empty-body
 *  case the sidecar rejects. */
function parsesAsJsonObject(body: BodyInit | null | undefined): boolean {
  if (typeof body !== "string" || body.length === 0) return false
  try {
    const parsed: unknown = JSON.parse(body)
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}

/**
 * Test harness that stubs `fetch` and separates the three surfaces
 * `usePtySession` talks to: terminal creation, SSE stream, and input
 * POSTs. Input POSTs are handed back to the test as pending handles so
 * the test can observe ordering and decide when each resolves.
 */
function installFetchHarness() {
  const inputPosts: PendingInput[] = []
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url.toString()
    const method = (init?.method ?? "GET").toUpperCase()

    if (href.endsWith("/terminals") && method === "POST") {
      // Mirror the sidecar contract rather than accepting anything: the route
      // declares a required JSON object, so an absent or unparseable body is
      // a 400 there. A mock that answers 201 regardless cannot observe a
      // client that stops sending one.
      if (!parsesAsJsonObject(init?.body)) {
        return mockResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({ error: "Malformed JSON in request body" }),
        })
      }
      return mockResponse({
        ok: true,
        status: 201,
        body: JSON.stringify({ data: { sessionId: SESSION_ID } }),
      })
    }

    if (href.endsWith(`/terminals/${SESSION_ID}/stream`) && method === "GET") {
      // Provide a stream we can keep open for the duration of the test.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      })
      // Hono/lib.dom typings infer `ReadableStream<Uint8Array<ArrayBuffer>>`
      // for `Response.body`, but the public ReadableStream constructor in
      // jsdom yields `Uint8Array<ArrayBufferLike>`. The payloads don't
      // differ at runtime; cast at the fetch boundary.
      const res = {
        ok: true,
        status: 200,
        body,
      } as unknown as Response
      return res
    }

    if (href.endsWith(`/terminals/${SESSION_ID}/input`) && method === "POST") {
      const call: FetchCall = {
        url: href,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      }
      const d = deferred<Response>()
      // Mirror real fetch semantics: if the caller passed an
      // AbortSignal and it gets aborted before the test resolves the
      // deferred, the fetch rejects with a DOMException named
      // "AbortError". Without this, aborted input POSTs would hang.
      const signal = init?.signal
      if (signal) {
        const onAbort = () => {
          const err = new DOMException("The operation was aborted.", "AbortError")
          d.reject(err)
        }
        if (signal.aborted) {
          onAbort()
        } else {
          signal.addEventListener("abort", onAbort, { once: true })
        }
      }
      inputPosts.push({
        call,
        settle: (response) => d.resolve(response),
        reject: (err) => d.reject(err),
      })
      return d.promise
    }

    if (href.endsWith(`/terminals/${SESSION_ID}`) && method === "DELETE") {
      return mockResponse({ ok: true, status: 200 })
    }

    throw new Error(`Unexpected fetch: ${method} ${href}`)
  })

  vi.stubGlobal("fetch", fetchMock)
  installFailFastWebSocketStub()

  return {
    fetchMock,
    inputPosts,
    closeStream: () => {
      streamController?.close()
      streamController = null
    },
  }
}

describe("usePtySession input serialization", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function mountAndWaitForSession() {
    const harness = installFetchHarness()
    const onData = vi.fn()
    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData }),
    )
    // Wait until the terminal has been created (both the create POST
    // and the SSE stream GET have completed). Until then sendCommand
    // would reject because sessionIdRef is still null.
    await waitFor(() => {
      expect(hook.result.current.isConnected).toBe(true)
    })
    return { ...harness, hook }
  }

  it("creates the terminal with a JSON object body carrying the geometry", async () => {
    const { fetchMock } = await mountAndWaitForSession()

    const create = fetchMock.mock.calls.find(([url, init]) => {
      const href = typeof url === "string" ? url : url.toString()
      return href.endsWith("/terminals") && (init?.method ?? "GET").toUpperCase() === "POST"
    })
    expect(create).toBeDefined()

    const [, init] = create!
    // Declaring JSON and then sending nothing is what the sidecar rejects as
    // malformed — the header and the body have to agree.
    expect(
      new Headers(init?.headers as HeadersInit).get("content-type"),
    ).toBe("application/json")
    expect(typeof init?.body).toBe("string")
    // The hook's pre-resize defaults (80x24), inlined rather than exported —
    // the values are module-private and not part of the public surface.
    expect(JSON.parse(init!.body as string)).toEqual({ cols: 80, rows: 24 })
  })

  it("dispatches at most one input POST at a time", async () => {
    const { inputPosts, hook } = await mountAndWaitForSession()

    // Attach a noop catch so any promises that end up rejected at
    // teardown (buffered waiters rejected by cleanup) don't surface
    // as unhandled rejections in the runner. This mirrors how xterm's
    // onData handler wraps sendCommand().catch(...).
    const send = (s: string) =>
      hook.result.current.sendCommand(s).catch(() => {})

    await act(async () => {
      // Fire 5 keystrokes back-to-back without awaiting between them,
      // matching how xterm's onData handler calls sendCommand.
      void send("h")
      void send("e")
      void send("l")
      void send("l")
      void send("o")
      // Let microtasks settle so the queue has a chance to flush.
      await Promise.resolve()
    })

    // The first keystroke kicks off a POST immediately. The remaining
    // four must be coalesced into at most one follow-up POST — they
    // must not race through as 4 concurrent requests.
    expect(inputPosts).toHaveLength(1)
    expect(JSON.parse(inputPosts[0].call.body ?? "{}")).toEqual({ data: "h" })

    // Clean up outstanding POSTs so unmount doesn't reject waiters.
    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(inputPosts).toHaveLength(2))
      inputPosts[1].settle(mockResponse({ ok: true, status: 200 }))
    })
  })

  it("coalesces keystrokes received during an in-flight request", async () => {
    const { inputPosts, hook } = await mountAndWaitForSession()

    // First keystroke starts a POST.
    let firstSettled = false
    act(() => {
      void hook.result.current.sendCommand("h").then(() => {
        firstSettled = true
      })
    })
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    // Four more keystrokes arrive while the first POST is still
    // in flight. They should accumulate into a single follow-up.
    act(() => {
      void hook.result.current.sendCommand("e")
      void hook.result.current.sendCommand("l")
      void hook.result.current.sendCommand("l")
      void hook.result.current.sendCommand("o")
    })

    // Nothing new should have been dispatched yet.
    expect(inputPosts).toHaveLength(1)
    expect(firstSettled).toBe(false)

    // Resolve the first POST; the drain loop should now fire exactly
    // one more POST containing the coalesced "ello".
    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(inputPosts).toHaveLength(2))
    })

    expect(JSON.parse(inputPosts[1].call.body ?? "{}")).toEqual({ data: "ello" })

    await act(async () => {
      inputPosts[1].settle(mockResponse({ ok: true, status: 200 }))
    })
  })

  it("preserves keystroke order across coalesced batches", async () => {
    const { inputPosts, hook } = await mountAndWaitForSession()

    act(() => {
      void hook.result.current.sendCommand("a")
    })
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    act(() => {
      void hook.result.current.sendCommand("b")
      void hook.result.current.sendCommand("c")
    })

    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(inputPosts).toHaveLength(2))
    })

    act(() => {
      void hook.result.current.sendCommand("d")
    })

    await act(async () => {
      inputPosts[1].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(inputPosts).toHaveLength(3))
      inputPosts[2].settle(mockResponse({ ok: true, status: 200 }))
    })

    const bodies = inputPosts.map((p) => JSON.parse(p.call.body ?? "{}").data)
    // Concatenating the dispatched batches must yield the original
    // keystroke sequence. This is the user-facing ordering invariant.
    expect(bodies.join("")).toBe("abcd")
    expect(bodies).toEqual(["a", "bc", "d"])
  })

  it("resolves every sendCommand's promise when its batch succeeds", async () => {
    const { inputPosts, hook } = await mountAndWaitForSession()

    let p1Settled = false
    let p2Settled = false
    let p3Settled = false
    act(() => {
      void hook.result.current.sendCommand("x").then(() => {
        p1Settled = true
      })
    })
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    act(() => {
      void hook.result.current.sendCommand("y").then(() => {
        p2Settled = true
      })
      void hook.result.current.sendCommand("z").then(() => {
        p3Settled = true
      })
    })

    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(p1Settled).toBe(true))
    })
    expect(p2Settled).toBe(false)
    expect(p3Settled).toBe(false)

    await act(async () => {
      await waitFor(() => expect(inputPosts).toHaveLength(2))
      inputPosts[1].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => {
        expect(p2Settled).toBe(true)
        expect(p3Settled).toBe(true)
      })
    })
  })

  it("buffers keystrokes submitted before the session exists and flushes on connect", async () => {
    // Don't use mountAndWaitForSession — we want to race against
    // connect() rather than waiting for it to complete.
    const harness = installFetchHarness()
    // Deliberately slow the create POST so keystrokes can land before
    // the terminal is ready.
    const createDeferred = deferred<Response>()
    const baseFetch = harness.fetchMock.getMockImplementation()
    harness.fetchMock.mockImplementation(async (url, init) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        return createDeferred.promise
      }
      return baseFetch!(url, init)
    })

    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData: vi.fn() }),
    )

    // sessionId isn't set yet; this keystroke must not drop silently
    // and must not eagerly reject.
    let settled = false
    act(() => {
      void hook.result.current.sendCommand("boot").then(() => {
        settled = true
      })
    })
    // Give the drain loop a microtask hop to prove it exits without
    // rejecting just because sid is null.
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(harness.inputPosts).toHaveLength(0)

    // Complete the create POST; the buffered keystroke should now be
    // flushed.
    await act(async () => {
      createDeferred.resolve(
        mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: SESSION_ID } }),
        }),
      )
      await waitFor(() => expect(harness.inputPosts).toHaveLength(1))
    })
    expect(JSON.parse(harness.inputPosts[0].call.body ?? "{}")).toEqual({
      data: "boot",
    })
    await act(async () => {
      harness.inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(settled).toBe(true))
    })
  })

  it("rejects every waiter in a failed batch", async () => {
    const { inputPosts, hook } = await mountAndWaitForSession()

    let err1: unknown = null
    let err2: unknown = null
    act(() => {
      void hook.result.current.sendCommand("p").catch((e) => {
        err1 = e
      })
    })
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    act(() => {
      void hook.result.current.sendCommand("q").catch((e) => {
        err2 = e
      })
    })

    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: false, status: 500, body: "boom" }))
      await waitFor(() => expect(err1).toBeInstanceOf(Error))
    })
    expect((err1 as Error).message).toBe("boom")
    // The second send is still pending — the next batch has not yet
    // been attempted. Let it dispatch and fail independently.
    await waitFor(() => expect(inputPosts).toHaveLength(2))
    await act(async () => {
      inputPosts[1].settle(mockResponse({ ok: false, status: 500, body: "boom2" }))
      await waitFor(() => expect(err2).toBeInstanceOf(Error))
    })
    expect((err2 as Error).message).toBe("boom2")
  })

  it("rejects every waiter in a coalesced multi-waiter batch when its POST fails", async () => {
    // Coverage gap: existing tests fail single-waiter batches. The
    // per-waiter rejection loop in drainInputQueue's catch block is
    // only exercised when a single POST carries multiple waiters.
    const { inputPosts, hook } = await mountAndWaitForSession()

    // First keystroke dispatches a POST and holds the drain so the
    // next three keystrokes coalesce into one follow-up batch.
    act(() => {
      void hook.result.current.sendCommand("x").catch(() => {})
    })
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    let err2: unknown = null
    let err3: unknown = null
    let err4: unknown = null
    act(() => {
      void hook.result.current.sendCommand("y").catch((e) => {
        err2 = e
      })
      void hook.result.current.sendCommand("z").catch((e) => {
        err3 = e
      })
      void hook.result.current.sendCommand("w").catch((e) => {
        err4 = e
      })
    })

    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
      await waitFor(() => expect(inputPosts).toHaveLength(2))
    })

    // All three late keystrokes must be in the single follow-up batch.
    expect(JSON.parse(inputPosts[1].call.body ?? "{}")).toEqual({ data: "yzw" })

    await act(async () => {
      inputPosts[1].settle(
        mockResponse({ ok: false, status: 500, body: "multi-boom" }),
      )
      await waitFor(() => {
        expect(err2).toBeInstanceOf(Error)
        expect(err3).toBeInstanceOf(Error)
        expect(err4).toBeInstanceOf(Error)
      })
    })
    // Every waiter in the batch must receive the same error.
    expect((err2 as Error).message).toBe("multi-boom")
    expect((err3 as Error).message).toBe("multi-boom")
    expect((err4 as Error).message).toBe("multi-boom")
  })

  it("does not starve the event loop when sendCommand fires before the session connects", async () => {
    // Regression test: before the fix, when sendCommand runs while
    // sessionIdRef is still null (mount-to-connect window),
    // drainInputQueue exited without clearing pendingBatchRef, and the
    // .finally() handler re-entered run() indefinitely because the
    // queue still had data. Each iteration enqueued a microtask,
    // starving the event loop and preventing the POST /terminals
    // macrotask from being dispatched — a deadlock in production.
    //
    // The in-test detector is a macrotask sentinel (setTimeout 0): if
    // microtasks are starved, the sentinel never fires. Real timers
    // are required; fake timers won't surface the starvation.
    const harness = installFetchHarness()
    const createDeferred = deferred<Response>()
    const baseFetch = harness.fetchMock.getMockImplementation()
    harness.fetchMock.mockImplementation(async (url, init) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        return createDeferred.promise
      }
      return baseFetch!(url, init)
    })

    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData: vi.fn() }),
    )

    act(() => {
      void hook.result.current.sendCommand("pre").catch(() => {})
    })

    // A sentinel macrotask. If the drain is busy-looping in microtasks,
    // this setTimeout callback will never run and the await below
    // times out. With the fix, macrotasks dispatch normally.
    const sentinelFired = await new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 0)
    })
    expect(sentinelFired).toBe(true)

    // And the pre-connect keystroke is still buffered — it must not
    // have been dropped or rejected during the starvation-free wait.
    expect(harness.inputPosts).toHaveLength(0)

    // Complete connect and verify the buffered keystroke dispatches.
    await act(async () => {
      createDeferred.resolve(
        mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: SESSION_ID } }),
        }),
      )
      await waitFor(() => expect(harness.inputPosts).toHaveLength(1))
    })
    expect(JSON.parse(harness.inputPosts[0].call.body ?? "{}")).toEqual({
      data: "pre",
    })
    await act(async () => {
      harness.inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
    })
  })

  it("rejects in-flight batch waiters when the hook unmounts mid-request", async () => {
    // Previously `cleanup()` only rejected waiters that were still
    // sitting in `pendingBatchRef`; waiters attached to a batch that
    // the drain had already swapped out were invisible and settled
    // based on the (now meaningless) fetch result. This test pins the
    // contract that unmount rejects in-flight waiters as well.
    const { inputPosts, hook } = await mountAndWaitForSession()

    let inFlightErr: unknown = null
    act(() => {
      void hook.result.current.sendCommand("typing").catch((e) => {
        inFlightErr = e
      })
    })
    // Wait until the POST is actually in flight (batch has been swapped
    // out of pendingBatchRef and is awaiting fetch).
    await waitFor(() => expect(inputPosts).toHaveLength(1))

    // Unmount while the POST is still pending.
    hook.unmount()

    // The in-flight waiter must reject — not linger, not resolve when
    // the test harness never settles the POST.
    await waitFor(() => expect(inFlightErr).toBeInstanceOf(Error))
    expect((inFlightErr as Error).message).toBe("Terminal session is not connected")
  })
})

/**
 * Tests for the WebSocket transport. The current sidecar creates or attaches
 * the PTY from the WebSocket itself: the browser opens `/terminals/:id/ws`,
 * sends a JSON `init` control frame, and then sends JSON `input` frames.
 * These tests pin the input/output framing contract the matching server
 * endpoint must honor.
 */
describe("usePtySession WebSocket transport", () => {
  const INTERACTIVE_CONTROL = {
    refDigest: "sha256:interactive-ref",
    generation: 1,
    leaseId: "lease-1",
    holderId: "browser-1",
    expiresAt: "2026-08-16T12:00:00.000Z",
  } as const

  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /**
   * Test harness that pairs the openable WebSocket stub with a fetch
   * mock that records any HTTP
   * request to `/input`, `/stream`, or PATCH on the session is treated
   * as a contract violation — when the WS is open the hook MUST NOT
   * fall back to the HTTP path.
   */
  function installWsHarness(options: { emitCloseOnClose?: boolean } = {}) {
    const wsStub = installOpeningWebSocketStub(options)
    const stray: FetchCall[] = []

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()

      // Any request is a fallback we shouldn't be hitting while the
      // current sidecar WS protocol is open. Record it so the assertion
      // below can flag it.
      stray.push({
        url: href,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      })
      return mockResponse({ ok: true, status: 200 })
    })

    vi.stubGlobal("fetch", fetchMock)

    return { ...wsStub, stray, fetchMock }
  }

  function openAndReady(handle: FakeWsHandle) {
    act(() => {
      handle.open()
      handle.pushMessage(JSON.stringify({ type: "ready" }))
    })
  }

  async function mountAndOpenWs(apiUrl = API_URL) {
    const harness = installWsHarness()
    const onData = vi.fn()
    const hook = renderHook(() =>
      usePtySession({ apiUrl, token: fixtureValue, onData }),
    )
    // Wait for the hook's `connect()` to construct the WebSocket.
    await waitFor(() => expect(harness.handles).toHaveLength(1))
    // Drive the socket open and the server ready acknowledgement.
    openAndReady(harness.handles[0])
    expect(harness.handles[0].sentText).toEqual([
      JSON.stringify({ type: "init", cols: 80, rows: 24 }),
    ])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    return { ...harness, hook, onData }
  }

  it("constructs the WebSocket with wss:// and the bearer subprotocol (token NOT in URL)", async () => {
    const { handles } = await mountAndOpenWs()
    expect(handles).toHaveLength(1)
    const url = new URL(handles[0].url)
    expect(url.protocol).toBe("wss:")
    expect(url.pathname).toMatch(/^\/terminals\/terminal-[^/]+\/ws$/)
    // The bearer token MUST NOT appear in the URL query string —
    // edge proxies and DevTools log URLs but not subprotocol headers.
    expect(url.searchParams.get("token")).toBeNull()
    expect(url.search).toBe("")

    // The subprotocol carries a base64url-encoded bearer token under
    // the `bearer.` prefix. Verify the encoding round-trips cleanly:
    // backends decode the part after `bearer.` and base64url-decode
    // it back to the raw token.
    // Two offers: the non-credential marker the server echoes into the 101,
    // then the credential. The marker is REQUIRED — a server must never echo
    // `bearer.<…>` back in a response header, and Chrome fails the handshake
    // when it offered subprotocols and the server selected none.
    expect(handles[0].protocols).toEqual([
      "tangle.terminal.v1",
      expect.stringMatching(/^bearer\./),
    ])
    const proto = handles[0].protocols[1]
    expect(proto.startsWith("bearer.")).toBe(true)
    const encoded = proto.slice("bearer.".length)
    // base64url-safe characters only
    expect(/^[A-Za-z0-9_-]+$/.test(encoded)).toBe(true)
    // Round-trip: pad to base64, swap url-safe chars back, atob.
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4)
    const standard = padded.replace(/-/g, "+").replace(/_/g, "/")
    expect(atob(standard)).toBe(fixtureValue)
  })

  it("does not report connected or send queued input until the server sends ready", async () => {
    const harness = installWsHarness()
    const hook = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData: vi.fn(),
      }),
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    act(() => harness.handles[0].open())

    expect(hook.result.current.isConnected).toBe(false)
    expect(harness.handles[0].sentText).toEqual([
      JSON.stringify({ type: "init", cols: 80, rows: 24 }),
    ])

    let inputSettled = false
    let inputPromise!: Promise<void>
    act(() => {
      inputPromise = hook.result.current.sendCommand("before-ready").then(() => {
        inputSettled = true
      })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(inputSettled).toBe(false)
    expect(harness.handles[0].sentText).not.toContain(
      JSON.stringify({ type: "input", data: "before-ready" }),
    )

    act(() => {
      harness.handles[0].pushMessage(JSON.stringify({ type: "ready" }))
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await act(async () => {
      await inputPromise
    })

    expect(inputSettled).toBe(true)
    expect(harness.handles[0].sentText).toContain(
      JSON.stringify({ type: "input", data: "before-ready" }),
    )
    hook.unmount()
  })

  it("sends the exact interactive identity on every WebSocket init", async () => {
    const harness = installWsHarness()
    const hook = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData: vi.fn(),
        connectionId: "interactive-session",
        incarnationId: "incarnation-1",
        control: INTERACTIVE_CONTROL,
      }),
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    openAndReady(harness.handles[0])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    expect(JSON.parse(harness.handles[0].sentText[0])).toEqual({
      type: "init",
      incarnationId: "incarnation-1",
      control: INTERACTIVE_CONTROL,
      cols: 80,
      rows: 24,
    })
    expect(harness.stray).toEqual([])

    hook.unmount()
  })

  it("reconnects the exact socket when the control generation changes", async () => {
    const harness = installWsHarness()
    const hook = renderHook(
      ({ control }: { control: AgentInteractiveSessionControlClaim }) =>
        usePtySession({
          apiUrl: API_URL,
          token: fixtureValue,
          onData: vi.fn(),
          connectionId: "interactive-session",
          incarnationId: "incarnation-1",
          control,
        }),
      {
        initialProps: {
          control: INTERACTIVE_CONTROL as AgentInteractiveSessionControlClaim,
        },
      },
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    openAndReady(harness.handles[0])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    const rotated = {
      ...INTERACTIVE_CONTROL,
      generation: 2,
      leaseId: "lease-2",
    } as const
    act(() => hook.rerender({ control: rotated }))

    await waitFor(() => expect(harness.handles).toHaveLength(2))
    expect(harness.handles[0].readyState).toBe(3)
    openAndReady(harness.handles[1])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    expect(JSON.parse(harness.handles[1].sentText[0])).toMatchObject({
      type: "init",
      incarnationId: "incarnation-1",
      control: rotated,
    })

    hook.unmount()
  })

  it("ignores late events from the old exact socket after a delayed close", async () => {
    const harness = installWsHarness({ emitCloseOnClose: false })
    const onData = vi.fn()
    const hook = renderHook(
      ({ control }: { control: AgentInteractiveSessionControlClaim }) =>
        usePtySession({
          apiUrl: API_URL,
          token: fixtureValue,
          onData,
          connectionId: "interactive-session",
          incarnationId: "incarnation-1",
          control,
        }),
      {
        initialProps: {
          control: INTERACTIVE_CONTROL as AgentInteractiveSessionControlClaim,
        },
      },
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    openAndReady(harness.handles[0])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    let resolveStaleBlob!: (value: string) => void
    const staleBlob = {
      text: () => new Promise<string>((resolve) => {
        resolveStaleBlob = resolve
      }),
    } as unknown as Blob
    act(() => harness.handles[0].pushBlob(staleBlob))

    const rotated = {
      ...INTERACTIVE_CONTROL,
      generation: 2,
      leaseId: "lease-2",
    } as const
    act(() => hook.rerender({ control: rotated }))
    await waitFor(() => expect(harness.handles).toHaveLength(2))

    let queuedInputResolved = false

    // Queue input while B is still connecting. The command must wait for
    // B's ready frame and then use B, without opening a retry socket.
    let queuedInput!: Promise<void>
    act(() => {
      queuedInput = hook.result.current.sendCommand("queued-on-b").then(() => {
        queuedInputResolved = true
      })
    })
    await Promise.resolve()
    expect(queuedInputResolved).toBe(false)
    expect(harness.handles[1].sentText).toEqual([])

    openAndReady(harness.handles[1])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    await waitFor(() => expect(queuedInputResolved).toBe(true))
    await expect(queuedInput).resolves.toBeUndefined()
    expect(harness.handles[1].sentText).toContain(
      JSON.stringify({ type: "input", data: "queued-on-b" }),
    )

    // Browser close delivery can lag behind the replacement connection.
    // Fire the old socket's close first, then deliver every late frame and
    // finish the deferred Blob decode after B is already the active socket.
    harness.handles[0].emitClose(1006)
    act(() => {
      harness.handles[0].pushMessage("stale-output")
      harness.handles[0].pushMessage(JSON.stringify({ type: "ready" }))
      harness.handles[0].pushMessage(
        JSON.stringify({ type: "error", message: "stale-error" }),
      )
      harness.handles[0].pushMessage(JSON.stringify({ type: "exit" }))
      harness.handles[0].pushBlob(staleBlob)
      resolveStaleBlob("stale-blob-output")
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hook.result.current.isConnected).toBe(true)
    expect(hook.result.current.error).toBeNull()
    expect(onData).not.toHaveBeenCalled()

    // A's delayed close must not schedule a duplicate reconnect after the
    // one-second retry window, and B must remain the only replacement.
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(harness.handles).toHaveLength(2)
    expect(hook.result.current.isConnected).toBe(true)

    hook.unmount()
  })

  it("fails closed when an interactive identity is incomplete", async () => {
    const harness = installWsHarness()
    const hook = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData: vi.fn(),
        connectionId: "interactive-session",
        incarnationId: "incarnation-1",
      }),
    )

    await waitFor(() =>
      expect(hook.result.current.error).toBe(
        "Interactive terminal identity is incomplete",
      ),
    )
    expect(harness.handles).toHaveLength(0)
    expect(harness.stray).toEqual([])

    hook.unmount()
  })

  it("fails closed when the sidecar rejects a stale interactive identity", async () => {
    const harness = installWsHarness()
    const hook = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData: vi.fn(),
        connectionId: "interactive-session",
        incarnationId: "stale-incarnation",
        control: INTERACTIVE_CONTROL,
      }),
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    act(() => {
      harness.handles[0].open()
      harness.handles[0].pushMessage(
        JSON.stringify({
          type: "error",
          message: "Interactive session identity is stale",
        }),
      )
      harness.handles[0].close(1008)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(false))
    expect(hook.result.current.error).toContain("identity is stale")
    expect(harness.stray).toEqual([])

    hook.unmount()
  })

  it("constructs a same-origin WebSocket when apiUrl is relative", async () => {
    const { handles } = await mountAndOpenWs("/api/runtime/sandbox-123")
    expect(handles).toHaveLength(1)
    const url = new URL(handles[0].url)
    expect(url.protocol).toBe("ws:")
    expect(url.host).toBe(window.location.host)
    expect(url.pathname).toMatch(
      /^\/api\/runtime\/sandbox-123\/terminals\/terminal-[^/]+\/ws$/,
    )
  })

  it("reuses a provided connectionId across remounts so the sidecar restores the session", async () => {
    const harness = installWsHarness()
    const onData = vi.fn()
    const CONNECTION_ID = "terminal-stable-abc123"

    // First mount opens a WS keyed by the provided id.
    const first = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData,
        connectionId: CONNECTION_ID,
      }),
    )
    await waitFor(() => expect(harness.handles).toHaveLength(1))
    expect(new URL(harness.handles[0].url).pathname).toBe(
      `/terminals/${CONNECTION_ID}/ws`,
    )
    openAndReady(harness.handles[0])
    await waitFor(() => expect(first.result.current.isConnected).toBe(true))
    first.unmount()

    // Remount (tab switch back) must reuse the SAME id — not a fresh
    // random one — so the sidecar reattaches the existing PTY instead
    // of spawning a new shell.
    const second = renderHook(() =>
      usePtySession({
        apiUrl: API_URL,
        token: fixtureValue,
        onData,
        connectionId: CONNECTION_ID,
      }),
    )
    await waitFor(() => expect(harness.handles).toHaveLength(2))
    expect(new URL(harness.handles[1].url).pathname).toBe(
      `/terminals/${CONNECTION_ID}/ws`,
    )
    openAndReady(harness.handles[1])
    second.unmount()
  })

  it("does not reconnect or fall through to POST when only the token changes", async () => {
    // The connection endpoint mints a fresh token on every call (incl.
    // the dev double-invoke and periodic refresh). A new token must NOT
    // tear down the live socket and re-dial the same stable id — that
    // overlapping churn is what left the terminal stuck reconnecting.
    const harness = installWsHarness()
    const onData = vi.fn()
    const CONNECTION_ID = "terminal-stable-race"

    const hook = renderHook(
      ({ token }: { token: string }) =>
        usePtySession({
          apiUrl: API_URL,
          token,
          onData,
          connectionId: CONNECTION_ID,
        }),
      { initialProps: { token: "tok-1" } },
    )

    await waitFor(() => expect(harness.handles).toHaveLength(1))
    openAndReady(harness.handles[0])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // A freshly minted token must not open a new socket or reconnect.
    act(() => hook.rerender({ token: "tok-2" }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(harness.handles).toHaveLength(1) // no second WS dialed
    expect(hook.result.current.isConnected).toBe(true) // live socket kept
    expect(
      harness.stray.filter(
        (c) => c.url.endsWith("/terminals") && c.method === "POST",
      ),
    ).toEqual([]) // no REST fallback
    expect(hook.result.current.error).toBeNull()

    hook.unmount()
  })

  it("dispatches sendCommand as a JSON input frame and skips the HTTP /input path", async () => {
    const { handles, hook, stray } = await mountAndOpenWs()

    await act(async () => {
      void hook.result.current.sendCommand("hi")
      // Let the drain loop resolve. WS sends are synchronous so a single
      // microtask hop is enough.
      await Promise.resolve()
    })

    expect(handles[0].sentText).toEqual([
      JSON.stringify({ type: "init", cols: 80, rows: 24 }),
      JSON.stringify({ type: "input", data: "hi" }),
    ])
    expect(handles[0].sentBinary).toEqual([])
    expect(stray).toHaveLength(0)
  })

  it("coalesces keystrokes that arrive while the drain is running", async () => {
    // The drain loop processes the queue in batches even on the WS path.
    // For burst input the user-facing contract is the same as HTTP: bytes
    // arrive on the wire in submission order.
    const { handles, hook } = await mountAndOpenWs()

    await act(async () => {
      void hook.result.current.sendCommand("a")
      void hook.result.current.sendCommand("b")
      void hook.result.current.sendCommand("c")
      await Promise.resolve()
    })

    const inputFrames = handles[0].sentText
      .map((frame) => JSON.parse(frame))
      .filter((frame) => frame.type === "input")
      .map((frame) => frame.data)
    // Each batch translates to one ws.send, but all bytes appear in
    // submission order regardless of batching.
    expect(inputFrames.join("")).toBe("abc")
  })

  it("delivers server text frames to onData", async () => {
    const { handles, onData } = await mountAndOpenWs()

    act(() => {
      handles[0].pushMessage("hello\r\n")
      handles[0].pushMessage("\x1b[31mred\x1b[0m")
    })

    expect(onData).toHaveBeenCalledTimes(2)
    expect(onData).toHaveBeenNthCalledWith(1, "hello\r\n")
    expect(onData).toHaveBeenNthCalledWith(2, "\x1b[31mred\x1b[0m")
  })

  it("consumes recording control frames without rendering them", async () => {
    const { handles, onData } = await mountAndOpenWs()

    act(() => {
      handles[0].pushMessage(
        JSON.stringify({ type: "rec", sequence: 1, data: "capture" }),
      )
      handles[0].pushMessage(
        JSON.stringify({ type: "rec.done", sequence: 1 }),
      )
    })

    expect(onData).not.toHaveBeenCalled()
  })

  it("fails closed on unknown control frames instead of rendering them", async () => {
    const { handles, hook, onData, stray } = await mountAndOpenWs()

    act(() => {
      handles[0].pushMessage(
        JSON.stringify({ type: "future-control", payload: "must-not-render" }),
      )
    })

    await waitFor(() => expect(hook.result.current.isConnected).toBe(false))
    expect(hook.result.current.error).toBe(
      "Unknown terminal control frame: future-control",
    )
    expect(onData).not.toHaveBeenCalled()
    expect(stray).toEqual([])
    expect(handles).toHaveLength(1)
    await expect(hook.result.current.sendCommand("after-failure")).rejects.toThrow(
      "Terminal protocol failure",
    )
    hook.unmount()
  })

  it("decodes ArrayBuffer frames as UTF-8 and forwards to onData", async () => {
    // The wire contract sends server -> client output as TEXT frames,
    // but a binary-mode runtime (or an experimental backend) can
    // legitimately deliver an ArrayBuffer payload. The hook decodes
    // it as UTF-8; verifying this branch keeps the decode path from
    // silently dropping output if a frame ever arrives that way.
    //
    // Construct the ArrayBuffer with `new ArrayBuffer(...)` (rather
    // than `Uint8Array#buffer.slice(...)`) so the resulting object is
    // unambiguously the global `ArrayBuffer` constructor's instance —
    // jsdom realms can otherwise hand back a buffer that fails
    // `instanceof ArrayBuffer` against the hook's reference.
    const { handles, onData } = await mountAndOpenWs()
    const bytes = new TextEncoder().encode("buf-payload-é") // multi-byte char
    const buf = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buf).set(bytes)
    act(() => {
      handles[0].pushBinary(buf)
    })
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith("buf-payload-é")
  })

  it("decodes ArrayBufferView frames as UTF-8 and forwards to onData", async () => {
    // Some runtimes deliver a typed-array view (Uint8Array, etc.)
    // rather than the underlying ArrayBuffer. The hook handles both;
    // exercise the view branch explicitly.
    const { handles, onData } = await mountAndOpenWs()
    const view = new TextEncoder().encode("view-payload-✓")
    act(() => {
      handles[0].pushBinaryView(view)
    })
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith("view-payload-✓")
  })

  it("decodes Blob frames as UTF-8 and forwards to onData", async () => {
    // Older runtimes that didn't honor `binaryType = "arraybuffer"`
    // deliver a Blob. The hook's decode path is async (Blob.text())
    // — verify it eventually surfaces on onData.
    const { handles, onData } = await mountAndOpenWs()
    const blob = new Blob(["blob-payload-🌐"], {
      type: "application/octet-stream",
    })
    act(() => {
      handles[0].pushBlob(blob)
    })
    // Blob.text() is a microtask + Promise; let it settle.
    await waitFor(() => expect(onData).toHaveBeenCalledTimes(1))
    expect(onData).toHaveBeenCalledWith("blob-payload-🌐")
  })

  it("sends resize as a JSON text frame, not as a PATCH", async () => {
    const { handles, hook, stray } = await mountAndOpenWs()

    await act(async () => {
      await hook.result.current.resizeTerminal(120, 40)
    })

    expect(handles[0].sentText).toEqual([
      JSON.stringify({ type: "init", cols: 80, rows: 24 }),
      JSON.stringify({ type: "resize", cols: 120, rows: 40 }),
    ])
    expect(stray).toHaveLength(0)
  })

  it("flips isConnected to false when the WS closes mid-session", async () => {
    const { handles, hook } = await mountAndOpenWs()

    act(() => {
      handles[0].close(1006)
    })

    await waitFor(() => expect(hook.result.current.isConnected).toBe(false))
  })

  it("opens a fresh sidecar WebSocket after a mid-session WS close", async () => {
    // Pins the current sidecar reliability path: sessions born from
    // WS `init` do not have a REST/SSE session to fall back to. When a
    // healthy WS drops mid-session the hook must (1) flip isConnected
    // to false, (2) schedule the reconnect timer, (3) open a fresh WS,
    // and (4) route subsequent input through the new socket.
    const wsStub = installOpeningWebSocketStub()
    const stray: FetchCall[] = []

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      stray.push({
        url: href,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      })
      return mockResponse({ ok: true, status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData: vi.fn() }),
    )

    // Drive the WS handshake through OPEN and server READY.
    await waitFor(() => expect(wsStub.handles).toHaveLength(1))
    openAndReady(wsStub.handles[0])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))
    expect(stray).toEqual([])

    // Drop the socket. The hook treats this as a transient mid-session
    // failure and schedules a fresh sidecar WS.
    act(() => {
      wsStub.handles[0].close(1006)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(false))
    expect(stray).toEqual([])

    // The reconnect setTimeout is hardcoded at 1000ms in the WS onclose
    // handler. Use a generous waitFor window so this test stays robust
    // to scheduler jitter without leaning on fake timers (which would
    // collide with waitFor's polling).
    await waitFor(
      () => {
        expect(wsStub.handles).toHaveLength(2)
      },
      { timeout: 3000 },
    )
    openAndReady(wsStub.handles[1])
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // Subsequent input must travel over the new WebSocket, not be
    // swallowed by a reference to the closed socket.
    await act(async () => {
      void hook.result.current.sendCommand("after-failover").catch(() => {})
      await Promise.resolve()
    })
    expect(wsStub.handles[1].sentText).toContain(
      JSON.stringify({ type: "input", data: "after-failover" }),
    )
    expect(stray).toEqual([])
  })

  it("falls back to HTTP+SSE when WebSocket construction throws", async () => {
    // Some browsers throw synchronously on `new WebSocket(...)` if the
    // URL is rejected (e.g. mixed-content blocking). The hook must
    // surrender the WS path and run the existing SSE+POST flow.
    class ThrowingWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      constructor() {
        throw new Error("blocked")
      }
    }
    vi.stubGlobal("WebSocket", ThrowingWebSocket)

    const inputPosts: PendingInput[] = []
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        return mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: SESSION_ID } }),
        })
      }
      if (href.endsWith(`/terminals/${SESSION_ID}/stream`) && method === "GET") {
        return {
          ok: true,
          status: 200,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller
            },
          }),
        } as unknown as Response
      }
      if (href.endsWith(`/terminals/${SESSION_ID}/input`) && method === "POST") {
        const d = deferred<Response>()
        inputPosts.push({
          call: {
            url: href,
            method,
            body: typeof init?.body === "string" ? init.body : null,
          },
          settle: (res) => d.resolve(res),
          reject: (err) => d.reject(err),
        })
        return d.promise
      }
      if (href.endsWith(`/terminals/${SESSION_ID}`) && method === "DELETE") {
        return mockResponse({ ok: true, status: 200 })
      }
      throw new Error(`Unexpected fetch: ${method} ${href}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData: vi.fn() }),
    )
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // SSE was opened (otherwise isConnected wouldn't flip).
    expect(streamController).not.toBeNull()

    // sendCommand reaches the HTTP /input path.
    await act(async () => {
      void hook.result.current.sendCommand("z").catch(() => {})
      await waitFor(() => expect(inputPosts).toHaveLength(1))
    })
    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
    })
  })

  it("ignores an orphaned onclose from a previous connect cycle", async () => {
    // The hook's lifecycle effect re-runs whenever apiUrl or token
    // changes. If WS-A had already reached OPEN when the prop change
    // fired, real browsers emit its `close` event ASYNCHRONOUSLY —
    // after cleanup() ran, after the new effect restored
    // mountedRef=true, and after the new connect() opened WS-B. With
    // the wasActive snapshot in onclose, the orphan must NOT touch
    // shared state; without it, the orphan would call
    // setIsConnected(false) and schedule a reconnect timer that opens
    // a duplicate SSE stream against the new session.
    //
    // The shared `installOpeningWebSocketStub` fires onclose
    // synchronously inside `close()`, which side-steps the bug
    // because mountedRef briefly flips to false during cleanup. To
    // exercise the real-browser ordering we install a custom stub
    // here whose `close()` is silent — the test then fires the
    // orphan close manually AFTER the new transport is up.
    interface ControlledWs {
      readyState: 0 | 1 | 2 | 3
      onopen: ((ev: Event) => void) | null
      onmessage: ((ev: MessageEvent) => void) | null
      onerror: ((ev: Event) => void) | null
      onclose: ((ev: CloseEvent) => void) | null
      send: (data: unknown) => void
      close: () => void
      url: string
    }
    const instances: ControlledWs[] = []
    class ControlledWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState: 0 | 1 | 2 | 3 = 0
      binaryType: BinaryType = "blob"
      url: string
      onopen: ((ev: Event) => void) | null = null
      onmessage: ((ev: MessageEvent) => void) | null = null
      onerror: ((ev: Event) => void) | null = null
      onclose: ((ev: CloseEvent) => void) | null = null
      constructor(url: string) {
        this.url = url
        instances.push(this as unknown as ControlledWs)
      }
      send() {}
      // Mark closed but do NOT emit onclose — the test drives the
      // orphan close event explicitly to mimic real-browser async
      // emission.
      close() {
        if (this.readyState !== 3) this.readyState = 3
      }
    }
    vi.stubGlobal("WebSocket", ControlledWebSocket)

    const SESSION_A = "sess_A"
    const SESSION_B = "sess_B"
    let createCalls = 0
    const stray: FetchCall[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        createCalls++
        const sid = createCalls === 1 ? SESSION_A : SESSION_B
        return mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: sid } }),
        })
      }
      if (method === "DELETE" && /\/terminals\/[^/]+$/.test(href)) {
        return mockResponse({ ok: true, status: 200 })
      }
      stray.push({
        url: href,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      })
      return mockResponse({ ok: true, status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const hook = renderHook(
      ({ token }) =>
        usePtySession({ apiUrl: API_URL, token, onData: vi.fn() }),
      { initialProps: { token: "token-a" } },
    )

    // WS-A handshake: wait for the constructor, drive open, observe
    // the hook adopt the WS as its active transport.
    await waitFor(() => expect(instances).toHaveLength(1))
    act(() => {
      instances[0].readyState = 1
      instances[0].onopen?.({} as Event)
      instances[0].onmessage?.({
        data: JSON.stringify({ type: "ready" }),
      } as MessageEvent)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // Reconnect tears down the active WS-A (silent close in this stub)
    // and dials WS-B. A token change no longer reconnects (the token is
    // read from a ref), so drive the reconnect explicitly.
    act(() => {
      void hook.result.current.reconnect()
    })
    await waitFor(() => expect(instances).toHaveLength(2))
    act(() => {
      instances[1].readyState = 1
      instances[1].onopen?.({} as Event)
      instances[1].onmessage?.({
        data: JSON.stringify({ type: "ready" }),
      } as MessageEvent)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // Now fire WS-A's orphaned close event. Without the wasActive
    // guard this would: (a) flip isConnected to false even though
    // WS-B is healthy, and (b) schedule a reconnect timer that calls
    // connectStream(SESSION_B), opening a duplicate SSE stream.
    act(() => {
      instances[0].onclose?.({
        code: 1006,
        reason: "",
        wasClean: false,
      } as unknown as CloseEvent)
    })
    // Drain any queued state updates.
    await Promise.resolve()
    await Promise.resolve()

    // Active transport state is preserved.
    expect(hook.result.current.isConnected).toBe(true)
    // No fetch hit anything outside of the create-and-delete
    // perimeter — specifically no SSE GET against /stream and no
    // POST to /input.
    expect(stray).toEqual([])

    // Wait past the reconnect-timer delay (1000ms in WS onclose) to
    // confirm no deferred SSE open fires either.
    await new Promise((r) => setTimeout(r, 1100))
    expect(stray).toEqual([])
    expect(hook.result.current.isConnected).toBe(true)
  })

  it("aborts a still-handshaking WS on prop change and ignores its delayed open", async () => {
    // Pins the orphan-handshake race: when a prop change runs cleanup
    // while a WS is still CONNECTING, the pending socket must be
    // closed AND any later events from it must not corrupt the new
    // transport. Without the pendingWsRef tracking, the orphan's
    // onopen would overwrite wsRef with a socket connected to a now-
    // deleted session, and its eventual onclose would schedule a
    // duplicate SSE stream against the new session.
    interface ControlledWs {
      readyState: 0 | 1 | 2 | 3
      onopen: ((ev: Event) => void) | null
      onmessage: ((ev: MessageEvent) => void) | null
      onerror: ((ev: Event) => void) | null
      onclose: ((ev: CloseEvent) => void) | null
      send: (data: unknown) => void
      close: () => void
      sent: unknown[]
      url: string
    }
    const instances: ControlledWs[] = []
    class ControlledWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState: 0 | 1 | 2 | 3 = 0
      binaryType: BinaryType = "blob"
      url: string
      onopen: ((ev: Event) => void) | null = null
      onmessage: ((ev: MessageEvent) => void) | null = null
      onerror: ((ev: Event) => void) | null = null
      onclose: ((ev: CloseEvent) => void) | null = null
      sent: unknown[] = []
      constructor(url: string) {
        this.url = url
        instances.push(this as unknown as ControlledWs)
      }
      send(data: unknown) {
        this.sent.push(data)
      }
      // Silent close: matches the real-browser semantic of an aborted
      // CONNECTING handshake (no onopen will follow), but lets the
      // test drive `onopen` and `onclose` explicitly to exercise the
      // orphan-event paths without timing assumptions.
      close() {
        if (this.readyState !== 3) this.readyState = 3
      }
    }
    vi.stubGlobal("WebSocket", ControlledWebSocket)

    const SESSION_A = "sess_A"
    const SESSION_B = "sess_B"
    let createCalls = 0
    const stray: FetchCall[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        createCalls++
        const sid = createCalls === 1 ? SESSION_A : SESSION_B
        return mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: sid } }),
        })
      }
      if (method === "DELETE" && /\/terminals\/[^/]+$/.test(href)) {
        return mockResponse({ ok: true, status: 200 })
      }
      stray.push({
        url: href,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      })
      return mockResponse({ ok: true, status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const hook = renderHook(
      ({ token }) =>
        usePtySession({ apiUrl: API_URL, token, onData: vi.fn() }),
      { initialProps: { token: "token-a" } },
    )

    // Wait for WS-A to be constructed but DO NOT drive its onopen —
    // it is intentionally left CONNECTING.
    await waitFor(() => expect(instances).toHaveLength(1))
    expect(instances[0].readyState).toBe(0)

    // Reconnect. cleanup() must abort the pending WS-A so the orphan
    // can never reach onopen against a session we've already DELETEd.
    // A token change no longer reconnects; drive it explicitly.
    act(() => {
      void hook.result.current.reconnect()
    })
    // After cleanup, WS-A's silent `close()` should have left it in
    // readyState 3.
    expect(instances[0].readyState).toBe(3)

    await waitFor(() => expect(instances).toHaveLength(2))
    act(() => {
      instances[1].readyState = 1
      instances[1].onopen?.({} as Event)
      instances[1].onmessage?.({
        data: JSON.stringify({ type: "ready" }),
      } as MessageEvent)
    })
    await waitFor(() => expect(hook.result.current.isConnected).toBe(true))

    // Now simulate a runtime that DOES fire `onopen` after a
    // CONNECTING-time `close()` — this is non-spec but our defenses
    // must hold either way. The pendingWsRef identity guard makes
    // the orphan surrender instead of overwriting wsRef.
    act(() => {
      instances[0].onopen?.({} as Event)
    })

    // Active transport state is undisturbed.
    expect(hook.result.current.isConnected).toBe(true)
    // The orphan's onopen must NOT have made WS-A the active
    // transport: a sendCommand should land on WS-B's outbox, not
    // WS-A's.
    await act(async () => {
      void hook.result.current.sendCommand("after-orphan").catch(() => {})
      await Promise.resolve()
    })
    const sentB = instances[1].sent.map((s) => {
      if (typeof s === "string") return s
      if (s instanceof ArrayBuffer) return new TextDecoder().decode(s)
      if (ArrayBuffer.isView(s))
        return new TextDecoder().decode(s as ArrayBufferView)
      return ""
    })
    expect(sentB.join("")).toContain("after-orphan")
    expect(instances[0].sent).toEqual([])

    // Fire the orphan's onclose. With the wasActive snapshot guard
    // (already on the branch from the prior round), this must not
    // schedule an SSE reconnect against the new session.
    act(() => {
      instances[0].onclose?.({
        code: 1006,
        reason: "",
        wasClean: false,
      } as unknown as CloseEvent)
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(hook.result.current.isConnected).toBe(true)
    expect(stray).toEqual([])

    // Wait past the (would-be) reconnect-timer window to confirm no
    // deferred SSE open fires either.
    await new Promise((r) => setTimeout(r, 1100))
    expect(stray).toEqual([])
    expect(hook.result.current.isConnected).toBe(true)
  })

  it("falls back to SSE+POST when the WebSocket fails to open", async () => {
    // A WS that never reaches OPEN (connection refused, a proxy that
    // doesn't speak WebSocket, a stuck upstream) must surrender so the
    // SSE+POST path takes over instead of stranding the terminal on a
    // "Connecting…" overlay. Both the direct and fallback dials hit
    // this stub; each closes without ever opening, driving the chain
    // POST /terminals -> SSE.

    class FailingWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState: 0 | 1 | 2 | 3 = 0
      binaryType: BinaryType = "blob"
      url: string
      onopen: ((ev: Event) => void) | null = null
      onmessage: ((ev: MessageEvent) => void) | null = null
      onerror: ((ev: Event) => void) | null = null
      onclose: ((ev: CloseEvent) => void) | null = null
      constructor(url: string) {
        this.url = url
        // Fail the handshake on the next tick: error then close,
        // without ever reaching OPEN, so connectWs settles false fast.
        setTimeout(() => {
          if (this.readyState === 3) return
          this.readyState = 3
          this.onerror?.({} as Event)
          this.onclose?.({
            code: 1006,
            reason: "",
            wasClean: false,
          } as unknown as CloseEvent)
        }, 5)
      }
      send() {}
      close() {
        if (this.readyState === 3) return
        this.readyState = 3
        this.onclose?.({
          code: 1006,
          reason: "",
          wasClean: false,
        } as unknown as CloseEvent)
      }
    }
    vi.stubGlobal("WebSocket", FailingWebSocket)

    const inputPosts: PendingInput[] = []
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | null = null
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      const method = (init?.method ?? "GET").toUpperCase()
      if (href.endsWith("/terminals") && method === "POST") {
        return mockResponse({
          ok: true,
          status: 201,
          body: JSON.stringify({ data: { sessionId: SESSION_ID } }),
        })
      }
      if (
        href.endsWith(`/terminals/${SESSION_ID}/stream`) &&
        method === "GET"
      ) {
        return {
          ok: true,
          status: 200,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller
            },
          }),
        } as unknown as Response
      }
      if (
        href.endsWith(`/terminals/${SESSION_ID}/input`) &&
        method === "POST"
      ) {
        const d = deferred<Response>()
        inputPosts.push({
          call: {
            url: href,
            method,
            body: typeof init?.body === "string" ? init.body : null,
          },
          settle: (res) => d.resolve(res),
          reject: (err) => d.reject(err),
        })
        return d.promise
      }
      if (href.endsWith(`/terminals/${SESSION_ID}`) && method === "DELETE") {
        return mockResponse({ ok: true, status: 200 })
      }
      throw new Error(`Unexpected fetch: ${method} ${href}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const hook = renderHook(() =>
      usePtySession({ apiUrl: API_URL, token: fixtureValue, onData: vi.fn() }),
    )

    // Both dials fail fast (close-without-open), then POST /terminals
    // + SSE take over. Give waitFor a generous window to observe the
    // chain settle and flip isConnected.
    await waitFor(
      () => {
        expect(streamController).not.toBeNull()
        expect(hook.result.current.isConnected).toBe(true)
      },
      { timeout: 5000 },
    )

    // After the fallback, sendCommand must travel over the HTTP
    // /input path (the WS was closed by the timer's ws.close()).
    await act(async () => {
      void hook.result.current
        .sendCommand("post-fallback")
        .catch(() => {})
      await waitFor(() => expect(inputPosts).toHaveLength(1))
    })
    expect(JSON.parse(inputPosts[0].call.body ?? "{}")).toEqual({
      data: "post-fallback",
    })

    // Drain the in-flight POST so unmount doesn't leak a rejection.
    await act(async () => {
      inputPosts[0].settle(mockResponse({ ok: true, status: 200 }))
    })
  })
})
