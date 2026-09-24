import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { options, cleaned } = vi.hoisted(() => ({
  options: [] as Array<Record<string, unknown>>,
  cleaned: vi.fn(),
}))
vi.mock("@pierre/diffs", () => ({
  FileDiff: class {
    constructor(value: Record<string, unknown>) { options.push(value) }
    hydrate() {}
    cleanUp() { cleaned() }
  },
  getSingularPatch: (patch: string) => ({ patch }),
}))
import { DiffView } from "./diff-view"

beforeEach(() => { options.length = 0; cleaned.mockClear() })
const longLine = `const url = "https://example.test/${"long-path-".repeat(100)}END_OF_LINE";\n`

describe("DiffView readability", () => {
  it("defaults to renderer wrapping and exposes its selected mode", () => {
    render(<DiffView filename="long.ts" baseline="old\n" current={longLine} />)
    expect(options.at(-1)?.overflow).toBe("wrap")
    expect(screen.getByRole("button", { name: "Wrap lines" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Diff for long.ts" })).toHaveAttribute("tabindex", "0")
  })
  it("offers an explicit scroll mode without retaining the old renderer", () => {
    render(<DiffView filename="long.ts" baseline="old\n" current={longLine} />)
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }))
    expect(options.at(-1)?.overflow).toBe("scroll")
    expect(cleaned).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Long lines scroll horizontally/)).toBeInTheDocument()
    expect(screen.getByTestId("diff-view").querySelectorAll("diffs-container")).toHaveLength(1)
  })
  it("keeps the complete patch available outside the renderer shadow root", () => {
    render(<DiffView filename="long.ts" baseline="old\n" current={longLine} />)
    const plain = screen.getByLabelText("Plain-text diff for long.ts")
    expect(plain.textContent).toContain("END_OF_LINE")
    expect(plain.textContent).toContain(longLine.trim())
    expect(plain).toHaveStyle({ overflowWrap: "anywhere" })
  })
  it("allows an explicit unwrapped initial preference", () => {
    render(<DiffView filename="x.ts" baseline="a\n" current="b\n" defaultWrap={false} showFileHeader={false} />)
    expect(options.at(-1)).toMatchObject({ overflow: "scroll", disableFileHeader: true })
  })
})
