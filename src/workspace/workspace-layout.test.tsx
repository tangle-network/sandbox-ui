import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import { WorkspaceLayout } from "./workspace-layout"

// jsdom doesn't implement matchMedia
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

describe("WorkspaceLayout — theme normalization", () => {
  it("sets data-sandbox-theme for valid themes", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="vault" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("data-sandbox-ui")).toBe("true")
    expect(root.getAttribute("data-sandbox-theme")).toBe("vault")
  })

  it("strips deprecated theme 'operator' — no data attributes set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="operator" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
    warnSpy.mockRestore()
  })

  it("strips deprecated theme 'builder' — no data attributes set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="builder" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
    warnSpy.mockRestore()
  })

  it("strips deprecated theme 'consumer' — no data attributes set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="consumer" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
    warnSpy.mockRestore()
  })

  it("emits console.warn for deprecated themes in development", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<WorkspaceLayout center={<div />} theme="operator" />)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('theme="operator" is deprecated'),
    )
    warnSpy.mockRestore()
  })

  it("sets no data attributes when theme is undefined", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
  })

  it("works for all new theme values", () => {
    const themes = ["vault", "ocean", "ember", "forest", "dawn"] as const
    for (const t of themes) {
      const { container, unmount } = render(
        <WorkspaceLayout center={<div />} theme={t} />,
      )
      const root = container.firstElementChild as HTMLElement
      expect(root.getAttribute("data-sandbox-theme")).toBe(t)
      unmount()
    }
  })
})
