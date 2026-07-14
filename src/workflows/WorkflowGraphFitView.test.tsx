// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The density toggle reframes the graph. `fitViewOnLayoutChange` decides HOW (see
 * WorkflowNode.test.tsx) — this covers the wiring: that the graph actually calls
 * React Flow with what that function returned, rather than the un-animated constant.
 * A regression there is invisible to a unit test of the helper alone.
 *
 * React Flow itself is stubbed: it measures a real viewport, which jsdom does not
 * have, and it is not the thing under test. The stub hands the component the one
 * thing it reaches for — the instance, via `onInit` — and renders the Panel so the
 * toggle is clickable.
 */
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
      onInit?: (instance: { fitView: typeof fitView }) => void
    }) => {
      useEffect(() => {
        onInit?.({ fitView })
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

afterEach(() => {
  cleanup()
  fitView.mockClear()
  vi.unstubAllGlobals()
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
  it("hands React Flow the ANIMATED framing, not the bare constant", async () => {
    readerToleratesMotion()
    render(<WorkflowGraph yaml={YAML} />)
    // Mounting does not refit — React Flow's own `fitView` prop already framed it.
    expect(fitView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await waitFor(() => expect(fitView).toHaveBeenCalledTimes(1))
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 220 }),
    )
  })

  it("reframes without moving for a reader who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
    }))
    render(<WorkflowGraph yaml={YAML} />)

    fireEvent.click(screen.getByRole("button", { name: /expand|compact/i }))

    await waitFor(() => expect(fitView).toHaveBeenCalledTimes(1))
    // Same framing, no transition.
    const options = fitView.mock.calls[0][0]
    expect(options).not.toHaveProperty("duration")
    expect(options).toHaveProperty("padding")
  })
})
