// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The density toggle reframes the graph. This covers HOW the reframe runs:
 *
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
  const { useEffect } = await import("react")
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
      useEffect(() => {
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

const { WorkflowGraph, LAYOUT_TRANSITION_MS } = await import("./WorkflowGraph")

const YAML = `
do:
  - agent.run:
      model: anthropic/claude-sonnet-4-5
      prompt: Review it.
  - integration.invoke:
      path: github.issues.create
`

/** jsdom lays out nothing — give the canvas wrapper a real frame so the
 *  reframe math has a width/height to fit into. */
const measureableFrame = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 960,
    height: 480,
    top: 0,
    left: 0,
    right: 960,
    bottom: 480,
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
    // Mounting does not refit — React Flow's own `fitView` prop already framed it.
    expect(setViewport).not.toHaveBeenCalled()

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
