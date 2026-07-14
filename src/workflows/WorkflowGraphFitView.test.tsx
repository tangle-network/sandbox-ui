// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The density toggle reframes the graph. `fitViewOnLayoutChange` decides HOW (see
 * WorkflowNode.test.tsx) — this covers the wiring: that the graph reframes by
 * SETTING a viewport computed from the structural nodes' own geometry, animated
 * per that function. It must NOT go through `fitView`: fitView reads React Flow's
 * measured node boxes, and measurement lags a density flip, so it raced the new
 * layout and framed the old node sizes as often as the new ones.
 *
 * React Flow itself is stubbed: it measures a real viewport, which jsdom does not
 * have, and it is not the thing under test. The stub hands the component the two
 * things it reaches for — the instance via `onInit`, and the Panel so the toggle
 * is clickable. jsdom reports every element as 0×0, so the wrapper is given a
 * real frame by stubbing getBoundingClientRect.
 */
const setViewport = vi.fn()
const fitView = vi.fn()

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  const { useEffect } = await import("react")
  return {
    ...actual,
    ReactFlow: ({
      children,
      onInit,
    }: {
      children?: React.ReactNode
      onInit?: (instance: {
        setViewport: typeof setViewport
        fitView: typeof fitView
      }) => void
    }) => {
      useEffect(() => {
        onInit?.({ setViewport, fitView })
      }, [onInit])
      return <div data-testid="react-flow">{children}</div>
    },
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  }
})

const { WorkflowGraph } = await import("./WorkflowGraph")

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

afterEach(() => {
  cleanup()
  setViewport.mockClear()
  fitView.mockClear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A browser that can report the preference, and says the reader has none. jsdom has
 *  no `matchMedia` at all — and a host that cannot report the preference gets no
 *  motion (see WorkflowNode.test.tsx), so the animated path has to be asked for. */
const readerToleratesMotion = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
  }))

describe("reframing on the density toggle", () => {
  it("SETS a computed viewport with the animated framing — it does not fitView", async () => {
    readerToleratesMotion()
    measureableFrame()
    render(<WorkflowGraph yaml={YAML} />)
    // Mounting does not refit — React Flow's own `fitView` prop already framed it.
    expect(setViewport).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    const [viewport, options] = setViewport.mock.calls[0]
    // A concrete viewport computed from the new layout's own geometry…
    expect(viewport).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        zoom: expect.any(Number),
      }),
    )
    // …delivered with the glide, and never via measurement-racing fitView.
    expect(options).toEqual({ duration: 220 })
    expect(fitView).not.toHaveBeenCalled()
  })

  it("reframes without moving for a reader who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
    }))
    measureableFrame()
    render(<WorkflowGraph yaml={YAML} />)

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await waitFor(() => expect(setViewport).toHaveBeenCalledTimes(1))
    // Same framing, no transition.
    expect(setViewport.mock.calls[0][1]).toBeUndefined()
  })

  it("skips the reframe while the canvas has no frame to fit into", async () => {
    readerToleratesMotion()
    // No getBoundingClientRect stub: jsdom's 0×0 stands in for display:none.
    render(<WorkflowGraph yaml={YAML} />)

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    // Give the deferred frame a chance to run, then confirm it declined.
    await new Promise((r) => setTimeout(r, 50))
    expect(setViewport).not.toHaveBeenCalled()
  })
})
