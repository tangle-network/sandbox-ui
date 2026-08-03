// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * How the graph frames itself — on mount, and again whenever a relayout moves
 * it.
 *
 * The FRAME (see `framingViewport`):
 * - A graph that fits is framed whole and centered.
 * - A graph that CANNOT fit at the zoom floor is anchored at its leading edge,
 *   not centered. Centering splits the overflow across both ends at once, which
 *   is what put the trigger off the left of the canvas while the last step ran
 *   off the right — two clipped nodes and nothing to say the graph continued.
 * - The frame is taken once there is a canvas with a size, so a panel measured
 *   LATE (a lazy chunk, a flex/hidden panel) is still framed. React Flow's own
 *   `fitView` prop cannot do this: it fires exactly once, against whatever the
 *   pane measured at that instant, and never refits.
 *
 * The REFRAME, when the density toggle relayouts:
 * - With motion allowed, the node geometry and the camera TWEEN together —
 *   many `setViewport` writes over ~220ms, none of them handed to React Flow's
 *   own animator (no `duration` option), because the tween drives both the
 *   nodes and the camera itself so edges re-route against the moving nodes.
 *   It must never go through `fitView`: fitView reads MEASURED node boxes,
 *   which lag a density flip, so it raced the new layout and framed the old
 *   sizes as often as the new.
 * - With reduced motion, the reframe is ATOMIC: exactly one instant
 *   `setViewport` alongside the node swap.
 * - With no frame to fit into (a hidden canvas), the viewport is not touched.
 *
 * React Flow itself is stubbed: it measures a real viewport, which jsdom does
 * not have, and it is not the thing under test. The stub hands the component
 * the instance via `onInit` and renders the Panel so the toggle is clickable.
 * jsdom lays out nothing and has no visual rAF, so both are stubbed too.
 */
const setViewport = vi.fn()
const getViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 1 }))
const fitView = vi.fn()
/** Every `nodes` prop the component handed React Flow, in write order — the
 *  observable record of what the graph actually rendered over time. */
let nodeWrites: Array<Array<{ id: string; data: { state?: { status?: string } } }>> = []

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  const { useEffect, useRef } = await import("react")
  return {
    ...actual,
    ReactFlow: ({
      children,
      nodes,
      onInit,
    }: {
      children?: React.ReactNode
      nodes?: Array<{ id: string; data: { state?: { status?: string } } }>
      onInit?: (instance: {
        setViewport: typeof setViewport
        getViewport: typeof getViewport
        fitView: typeof fitView
      }) => void
    }) => {
      if (nodes) nodeWrites.push(nodes)
      // Handed over exactly ONCE per mount, as `useOnInitHandler` does — it
      // guards on a ref, so a caller passing a fresh inline `onInit` each
      // render is still only given the instance once.
      const handedOver = useRef(false)
      useEffect(() => {
        if (handedOver.current) return
        handedOver.current = true
        onInit?.({ setViewport, getViewport, fitView })
      }, [onInit])
      return <div data-testid="react-flow">{children}</div>
    },
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  }
})

const { buildFlowGraph } = await import("./flow-graph")
const {
  WorkflowGraph,
  LAYOUT_TRANSITION_MS,
  FIT_VIEW,
  fitZoomFloor,
  framingViewport,
  layoutBounds,
} = await import("./WorkflowGraph")

const YAML = `
do:
  - agent.run:
      model: anthropic/claude-sonnet-4-5
      prompt: Review it.
  - integration.invoke:
      path: github.issues.create
`

/** A trigger plus `steps` agent steps — the long-pipeline shape a short panel
 *  cannot fit at the zoom floor. */
const chain = (steps: number) =>
  `on:\n  github.issues.opened: {}\ndo:\n${Array.from(
    { length: steps },
    (_, i) =>
      `  - agent.run:\n      model: anthropic/claude-sonnet-4-5\n      prompt: Step ${i}.\n`,
  ).join("")}`

/** jsdom lays out nothing — give the canvas wrapper a real frame so the
 *  reframe math has a width/height to fit into. */
const measureableFrame = (width = 960, height = 480) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)

/** Timer-driven animation frames, so the tween actually advances under jsdom. */
const timerDrivenFrames = () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16),
  )
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
}

const matchMediaSaying = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
  }))

afterEach(() => {
  cleanup()
  setViewport.mockClear()
  getViewport.mockClear()
  fitView.mockClear()
  nodeWrites = []
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("reframing on the density toggle", () => {
  it("tweens the camera itself — many un-animated writes, never fitView", async () => {
    matchMediaSaying(false)
    timerDrivenFrames()
    measureableFrame()
    render(<WorkflowGraph yaml={YAML} />)
    // Mounting takes the frame itself — React Flow's `fitView` prop is only a
    // pre-paint approximation. Set it aside; the tween is what's under test.
    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    setViewport.mockClear()

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    // The tween runs LAYOUT_TRANSITION_MS of ~16ms frames — several writes.
    await waitFor(
      () => expect(setViewport.mock.calls.length).toBeGreaterThan(2),
      { timeout: LAYOUT_TRANSITION_MS * 5 },
    )
    for (const [viewport, options] of setViewport.mock.calls) {
      // Each write is a concrete viewport the tween computed…
      expect(viewport).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        zoom: expect.any(Number),
      })
      // …applied instantly: the tween IS the animation, so handing React Flow
      // a duration would run a second animator underneath it.
      expect(options).toBeUndefined()
    }
    expect(fitView).not.toHaveBeenCalled()
  })

  it("reframes atomically for a reader who asked for less motion", async () => {
    matchMediaSaying(true)
    timerDrivenFrames()
    measureableFrame()
    render(<WorkflowGraph yaml={YAML} />)
    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    setViewport.mockClear()

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    const [viewport, options] = setViewport.mock.calls[0]
    expect(viewport).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      zoom: expect.any(Number),
    })
    expect(options).toBeUndefined()
    // One write is the whole reframe — give a straggling frame the chance to
    // prove there isn't one.
    await new Promise((r) => setTimeout(r, LAYOUT_TRANSITION_MS + 50))
    expect(setViewport).toHaveBeenCalledTimes(1)
  })

  it("carries a run-state tick that lands mid-tween through to the final frame", async () => {
    matchMediaSaying(false)
    timerDrivenFrames()
    measureableFrame()
    // An empty nodeState opts the graph into run-overlay mode, same as a
    // host that has a run but no per-node status yet.
    const { rerender } = render(<WorkflowGraph yaml={YAML} nodeState={{}} />)
    const id = nodeWrites.at(-1)?.[0]?.id
    expect(id).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))
    // The tick lands while the tween is running…
    rerender(
      <WorkflowGraph yaml={YAML} nodeState={{ [id!]: { status: "succeeded" } }} />,
    )
    await new Promise((r) => setTimeout(r, LAYOUT_TRANSITION_MS * 3))
    // …and the LAST write the graph made still carries it: the tween merges
    // run state at write time instead of stomping frames with a snapshot
    // taken when it started.
    const finalNode = nodeWrites.at(-1)?.find((n) => n.id === id)
    expect(finalNode?.data.state?.status).toBe("succeeded")
  })

  it("leaves the viewport alone while the canvas has no frame to fit into", async () => {
    matchMediaSaying(false)
    timerDrivenFrames()
    // No getBoundingClientRect stub: jsdom's 0×0 stands in for display:none.
    render(<WorkflowGraph yaml={YAML} />)

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await new Promise((r) => setTimeout(r, 50))
    expect(setViewport).not.toHaveBeenCalled()
  })
})

/**
 * The workflow detail panel: `h-[30rem]` tall, and roughly this wide beside the
 * step list. It is the frame the reported clipping was measured in.
 */
const PANEL = { width: 742, height: 480 }

/** Where the framed graph's leading and trailing edges land, in canvas pixels.
 *  Negative `left` / a `right` past the canvas width is a clipped node. */
function framedSpan(yaml: string, compact: boolean, panel = PANEL) {
  const { nodes, error } = buildFlowGraph(yaml, {
    nodeState: {},
    direction: "LR",
    compact,
  })
  expect(error).toBeNull()
  const bounds = layoutBounds(nodes)
  const viewport = framingViewport(bounds, panel.width, panel.height, compact)
  return {
    zoom: viewport.zoom,
    left: viewport.x + bounds.x * viewport.zoom,
    right: viewport.x + (bounds.x + bounds.width) * viewport.zoom,
  }
}

describe("framing a graph against its canvas", () => {
  it("frames a graph that fits whole, and centers it", () => {
    // Four steps of compact tiles fit the panel with room to spare.
    const { zoom, left, right } = framedSpan(chain(4), true)
    expect(zoom).toBeGreaterThan(fitZoomFloor(true))
    expect(left).toBeGreaterThan(0)
    expect(right).toBeLessThan(PANEL.width)
    // Nothing to anchor away from: the slack is shared evenly, as React Flow
    // frames it.
    expect(left).toBeCloseTo(PANEL.width - right, 5)
  })

  it("anchors the leading edge when the zoom floor stops the graph fitting", () => {
    // Seven compact steps need a zoom below the floor to fit 742px, so the fit
    // is clamped and the graph is deliberately wider than the canvas.
    const { zoom, left, right } = framedSpan(chain(7), true)
    expect(zoom).toBe(fitZoomFloor(true))
    expect(right).toBeGreaterThan(PANEL.width)
    // The regression: centering the clamped fit put the FIRST node at a
    // negative offset — the trigger half off the canvas — at the same time as
    // the last one ran off the right. The entry point now sits on canvas, and
    // every hidden step is in one direction.
    expect(left).toBeCloseTo(0, 5)
  })

  it("lets expanded cards shrink past the compact floor rather than slicing one", () => {
    // Full cards are ~4x the width of a tile, so the density toggle alone can
    // take a graph that fits into one that would not — at the COMPACT floor.
    // An expanded card's text is unreadable well before any zoom that fits a
    // real pipeline, so holding them there would only cost the last column.
    const expanded = framedSpan(chain(4), false)
    expect(expanded.zoom).toBeLessThan(fitZoomFloor(true))
    expect(expanded.zoom).toBeGreaterThan(fitZoomFloor(false))
    expect(expanded.left).toBeGreaterThan(0)
    expect(expanded.right).toBeLessThan(PANEL.width)
  })

  it("anchors expanded cards too, once even their own floor cannot fit them", () => {
    const expanded = framedSpan(chain(6), false)
    expect(expanded.zoom).toBe(fitZoomFloor(false))
    expect(expanded.right).toBeGreaterThan(PANEL.width)
    expect(expanded.left).toBeCloseTo(0, 5)
  })

  it("leaves a clamped fit alone while it still fits the canvas", () => {
    // Six steps land exactly on the floor and STILL fit 742px. Being clamped is
    // not what moves the camera — running off the canvas is.
    const yaml = chain(6)
    const wide = framedSpan(yaml, true)
    expect(wide.zoom).toBe(fitZoomFloor(true))
    expect(wide.left).toBeGreaterThan(0)
    expect(wide.right).toBeLessThan(PANEL.width)
    expect(wide.left).toBeCloseTo(PANEL.width - wide.right, 5)
    // The same graph in a narrower panel cannot fit, and is anchored.
    const narrow = { width: 520, height: 480 }
    const cramped = framedSpan(yaml, true, narrow)
    expect(cramped.right).toBeGreaterThan(narrow.width)
    expect(cramped.left).toBeCloseTo(0, 5)
  })

  it("measures bounds from the layout, not from a measured DOM box", () => {
    // Nothing in jsdom has ever been laid out, so any bounds read through React
    // Flow's measured boxes would be empty here. The layouter's own geometry is
    // the authority for the layout being framed, and it needs no measurement.
    const { nodes } = buildFlowGraph(chain(3), { direction: "LR", compact: true })
    const bounds = layoutBounds(nodes)
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
    expect(layoutBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe("framing a canvas that is measured late", () => {
  /** jsdom has no ResizeObserver. This one lets a test announce the moment the
   *  panel finally has a size. */
  const observeResizes = () => {
    const callbacks: Array<() => void> = []
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          callbacks.push(cb)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    return () => {
      for (const cb of callbacks) cb()
    }
  }

  it("frames the graph once a lazily-mounted panel finally has a size", async () => {
    matchMediaSaying(false)
    timerDrivenFrames()
    const resize = observeResizes()
    // The canvas mounts at 0×0 — a lazy chunk, or a flex/hidden panel that has
    // not been laid out yet. React Flow's own fitView has already fired and
    // spent itself against nothing by this point.
    render(<WorkflowGraph yaml={chain(7)} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(setViewport).not.toHaveBeenCalled()

    measureableFrame(PANEL.width, PANEL.height)
    resize()

    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    const [viewport] = setViewport.mock.calls[0]
    // Framed properly, not left at whatever the 0×0 fit produced: the layout
    // starts at the origin, so an anchored graph puts the camera there too.
    expect(viewport.zoom).toBe(fitZoomFloor(true))
    expect(viewport.x).toBeCloseTo(0, 5)
  })

  it("stops reframing once framed, so a later resize never yanks the reader", async () => {
    matchMediaSaying(false)
    timerDrivenFrames()
    const resize = observeResizes()
    measureableFrame(PANEL.width, PANEL.height)
    render(<WorkflowGraph yaml={chain(7)} />)

    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    resize()
    resize()

    await new Promise((r) => setTimeout(r, 50))
    expect(setViewport).toHaveBeenCalledTimes(1)
  })
})
