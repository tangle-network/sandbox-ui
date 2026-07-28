import { beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { WorkspaceLayout } from "./workspace-layout"

function mockDesktop(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  mockDesktop(true)
})

describe("WorkspaceLayout — theme", () => {
  it("sets data-sandbox-theme='vault' when vault theme is provided", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="vault" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("data-sandbox-ui")).toBe("true")
    expect(root.getAttribute("data-sandbox-theme")).toBe("vault")
  })

  it("sets no data attributes when theme is undefined", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
  })
})

describe("WorkspaceLayout — top header alignment", () => {
  it("pins every desktop pane header to the shell's 56px row", () => {
    const { getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
        centerHeader={<span>Center header</span>}
        right={<div>Right content</div>}
        rightHeader={<span>Right header</span>}
        defaultRightOpen
        resizable={false}
      />,
    )

    for (const label of ["Left header", "Center header", "Right header"]) {
      const header = getByText(label).closest("div.flex.h-14")
      expect(header).not.toBeNull()
      expect(header).toHaveClass("h-14", "shrink-0")
      expect(header?.className).not.toMatch(/\bpy-/)
    }
  })

  it("uses the same 56px row for mobile drawer headers", () => {
    mockDesktop(false)

    const { getByRole, getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
      />,
    )

    expect(getByRole("dialog", { name: "Left workspace panel" })).toBeInTheDocument()
    const header = getByText("Left header").closest("div.flex.h-14")
    expect(header).not.toBeNull()
    expect(header).toHaveClass("h-14", "shrink-0")
    expect(header?.className).not.toMatch(/\bpy-/)
  })
})
