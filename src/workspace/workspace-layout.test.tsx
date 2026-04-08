import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import { WorkspaceLayout } from "./workspace-layout"

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
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
