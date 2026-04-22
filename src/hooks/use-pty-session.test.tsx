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
