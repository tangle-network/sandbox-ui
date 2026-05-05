import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"

/**
 * Tests for the presentation-layer behaviors that wrap usePtySession:
 *  - the WebGL addon is loaded with a graceful canvas fallback
 *  - PTY output is coalesced into one xterm.write per animation frame
 *  - any pending RAF is cancelled on unmount so a late write does not
 *    fire against a disposed terminal
 *
 * @xterm/* is mocked at the module boundary because jsdom has no
 * canvas / WebGL stack, and `usePtySession` is mocked so the test can
 * call its `onData` argument directly without driving a real fetch /
 * WebSocket lifecycle.
 *
 * Mock spies live inside `vi.hoisted` so the `vi.mock` factories below
 * (which are hoisted by vitest before any top-level `const`) can refer
 * to them without tripping the temporal-dead-zone error.
 */

interface FakeTerminal {
  write: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  loadAddon: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  onData: ReturnType<typeof vi.fn>
  onResize: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  writeln: ReturnType<typeof vi.fn>
  cols: number
  rows: number
  options: { theme?: unknown }
}

const m = vi.hoisted(() => {
  const terminalRef: { current: FakeTerminal | null } = { current: null }
  const ptySessionStub = {
    isConnected: true,
    error: null as string | null,
    sendCommand: vi.fn(async () => {}),
    resizeTerminal: vi.fn(async () => {}),
    reconnect: vi.fn(),
  }
  const captured: { onData: ((d: string) => void) | null } = { onData: null }

  const webglOnContextLoss = vi.fn()
  const webglDispose = vi.fn()

  // `new` requires the implementation to have a [[Construct]] slot, so
  // each ctor below uses `function` (arrow fns can't be invoked with
  // `new` and the matching code paths in terminal-view.tsx do exactly
  // `new Terminal(...)` / `new FitAddon(...)` etc.).
  const TerminalCtor = vi.fn(function makeTerminal() {
    const inst: FakeTerminal = {
      write: vi.fn(),
      open: vi.fn(),
      loadAddon: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn(),
      onResize: vi.fn(),
      focus: vi.fn(),
      clear: vi.fn(),
      writeln: vi.fn(),
      cols: 80,
      rows: 24,
      options: {},
    }
    terminalRef.current = inst
    return inst
  })
  const FitAddonCtor = vi.fn(function makeFitAddon() {
    return { fit: vi.fn() }
  })
  const WebLinksAddonCtor = vi.fn(function makeWebLinksAddon() {
    return {}
  })
  const WebglAddonCtor = vi.fn(function makeWebglAddon() {
    return {
      onContextLoss: webglOnContextLoss,
      dispose: webglDispose,
    }
  })
  const usePtySessionMock = vi.fn(
    (opts: { onData: (data: string) => void }) => {
      captured.onData = opts.onData
      return ptySessionStub
    },
  )

  return {
    terminalRef,
    captured,
    ptySessionStub,
    TerminalCtor,
    FitAddonCtor,
    WebLinksAddonCtor,
    WebglAddonCtor,
    webglOnContextLoss,
    webglDispose,
    usePtySessionMock,
  }
})

vi.mock("@xterm/xterm", () => ({ Terminal: m.TerminalCtor }))
vi.mock("@xterm/addon-fit", () => ({ FitAddon: m.FitAddonCtor }))
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: m.WebLinksAddonCtor }))
vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: m.WebglAddonCtor }))
vi.mock("../hooks/use-pty-session", () => ({
  usePtySession: m.usePtySessionMock,
}))

import TerminalView from "./terminal-view"

// -- Manual RAF queue ---------------------------------------------------------
//
// jsdom's RAF timing is non-deterministic, and the component schedules
// multiple frames during init (one for the initial fit, additional ones
// per output burst). Stubbing both functions lets each test flush
// frames at known points and assert exactly which writes happened.

interface RafEntry {
  id: number
  cb: FrameRequestCallback
}
let rafQueue: RafEntry[] = []
let nextRafId = 1

function flushRaf(): void {
  // Snapshot first so callbacks scheduling new frames don't re-enter
  // and starve the test loop.
  const queue = rafQueue
  rafQueue = []
  for (const { cb } of queue) cb(performance.now())
}

beforeEach(() => {
  m.captured.onData = null
  m.terminalRef.current = null

  m.TerminalCtor.mockClear()
  m.FitAddonCtor.mockClear()
  m.WebLinksAddonCtor.mockClear()
  m.WebglAddonCtor.mockClear().mockImplementation(function () {
    return {
      onContextLoss: m.webglOnContextLoss,
      dispose: m.webglDispose,
    }
  })
  m.webglOnContextLoss.mockClear()
  m.webglDispose.mockClear()
  m.ptySessionStub.sendCommand.mockClear()
  m.ptySessionStub.resizeTerminal.mockClear()
  m.ptySessionStub.reconnect.mockClear()

  rafQueue = []
  nextRafId = 1
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextRafId++
    rafQueue.push({ id, cb })
    return id
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue = rafQueue.filter((r) => r.id !== id)
  })
  // jsdom doesn't provide ResizeObserver; the component constructs one
  // for fit-on-resize. A no-op stub keeps mount from throwing without
  // simulating layout changes (the tests don't exercise resize).
  class FakeResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderView() {
  return render(<TerminalView apiUrl="https://test.local" token="t" />)
}

describe("TerminalView — WebGL renderer load", () => {
  it("constructs the WebGL addon and loads it onto the terminal", () => {
    renderView()
    expect(m.WebglAddonCtor).toHaveBeenCalledTimes(1)
    expect(m.webglOnContextLoss).toHaveBeenCalledTimes(1)
    expect(m.terminalRef.current).not.toBeNull()
    const calls = m.terminalRef.current?.loadAddon.mock.calls ?? []
    // Don't pin the exact ordering of all addons — just confirm the
    // WebGL addon reaches loadAddon, which is what enables the GPU
    // rendering path.
    expect(
      calls.some(([addon]) =>
        addon !== null &&
        typeof addon === "object" &&
        (addon as { onContextLoss?: unknown }).onContextLoss ===
          m.webglOnContextLoss,
      ),
    ).toBe(true)
  })

  it("falls back gracefully when the WebGL addon constructor throws", () => {
    m.WebglAddonCtor.mockImplementationOnce(function () {
      throw new Error("no webgl context")
    })
    expect(() => renderView()).not.toThrow()
    // Other addons still got loaded — the mount path is not aborted by
    // a missing GPU renderer.
    expect(m.terminalRef.current).not.toBeNull()
    expect(m.FitAddonCtor).toHaveBeenCalledTimes(1)
    expect(m.WebLinksAddonCtor).toHaveBeenCalledTimes(1)
    expect(
      m.terminalRef.current?.loadAddon.mock.calls.length ?? 0,
    ).toBeGreaterThanOrEqual(2)
  })

  it("disposes the WebGL addon on unmount", () => {
    const { unmount } = renderView()
    expect(m.webglDispose).not.toHaveBeenCalled()
    unmount()
    expect(m.webglDispose).toHaveBeenCalledTimes(1)
    expect(m.terminalRef.current?.dispose).toHaveBeenCalledTimes(1)
  })
})

describe("TerminalView — RAF output coalescing", () => {
  it("coalesces multiple onData calls within one frame into a single xterm.write", () => {
    renderView()
    expect(m.captured.onData).not.toBeNull()
    expect(m.terminalRef.current).not.toBeNull()

    act(() => {
      m.captured.onData?.("a")
      m.captured.onData?.("b")
      m.captured.onData?.("c")
    })
    expect(m.terminalRef.current?.write).not.toHaveBeenCalled()

    act(() => {
      flushRaf()
    })

    expect(m.terminalRef.current?.write).toHaveBeenCalledTimes(1)
    expect(m.terminalRef.current?.write).toHaveBeenCalledWith("abc")
  })

  it("schedules one xterm.write per frame across distinct bursts", () => {
    renderView()

    act(() => {
      m.captured.onData?.("first")
    })
    act(() => {
      flushRaf()
    })

    act(() => {
      m.captured.onData?.("second")
      m.captured.onData?.("third")
    })
    act(() => {
      flushRaf()
    })

    const writes = m.terminalRef.current?.write.mock.calls.map(
      (c) => c[0] as string,
    )
    expect(writes).toEqual(["first", "secondthird"])
  })

  it("ignores empty data chunks without scheduling a frame", () => {
    renderView()

    // Drain frames the component scheduled at mount.
    act(() => {
      flushRaf()
    })
    const callCount = m.terminalRef.current?.write.mock.calls.length ?? 0

    act(() => {
      m.captured.onData?.("")
    })
    act(() => {
      flushRaf()
    })

    // No new write — the empty-string short-circuit kept the RAF from
    // being queued and the buffer from growing.
    expect(m.terminalRef.current?.write.mock.calls.length).toBe(callCount)
  })

  it("cancels the pending coalesce RAF on unmount and does not write", () => {
    const { unmount } = renderView()

    // Drain the init fit RAF first so the coalesce RAF is the only
    // pending frame when we unmount.
    act(() => {
      flushRaf()
    })

    act(() => {
      m.captured.onData?.("dropped-on-unmount")
    })
    expect(rafQueue.length).toBeGreaterThan(0)

    unmount()

    // The cleanup function calls cancelAnimationFrame; the queue must
    // no longer hold the coalesce frame.
    expect(rafQueue).toHaveLength(0)

    // And even if some other frame fires, the dropped-on-unmount data
    // never reaches the terminal.
    flushRaf()
    expect(m.terminalRef.current?.write).not.toHaveBeenCalledWith(
      "dropped-on-unmount",
    )
  })
})
