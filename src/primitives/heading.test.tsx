import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it } from "vitest"
import { Heading, PageHeader, SectionTitle } from "./heading"
import { PageShell } from "./page-shell"

describe("Heading", () => {
  it("renders the semantic default tag for each role", () => {
    const cases = [
      { role: "display", tag: "H1" },
      { role: "hero", tag: "H2" },
      { role: "page", tag: "H1" },
      { role: "section", tag: "H2" },
      { role: "subsection", tag: "H3" },
      { role: "eyebrow", tag: "P" },
    ] as const
    for (const { role, tag } of cases) {
      const { unmount } = render(<Heading role={role}>{role}</Heading>)
      expect(screen.getByText(role).tagName).toBe(tag)
      unmount()
    }
  })

  it("applies the role's type class and merges className", () => {
    render(
      <Heading role="page" className="custom-x">
        Title
      </Heading>,
    )
    const el = screen.getByText("Title")
    // page role = 30px display-font semibold; assert the token-backed size + the merge
    expect(el.className).toContain(
      "text-[length:var(--font-size-3xl,1.875rem)]",
    )
    expect(el.className).toContain("font-semibold")
    expect(el.className).toContain("custom-x")
  })

  it("honors the `as` override without changing the type class", () => {
    render(
      <Heading role="display" as="h2">
        Hero as h2
      </Heading>,
    )
    const el = screen.getByText("Hero as h2")
    expect(el.tagName).toBe("H2")
    expect(el.className).toContain(
      "text-[length:var(--font-size-display,3rem)]",
    )
  })

  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLElement>()
    render(
      <Heading ref={ref} role="section">
        Reffed
      </Heading>,
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("H2")
  })

  it("passes through standard HTML / data / aria attributes", () => {
    render(
      <Heading role="page" id="pg" data-testid="hp" aria-label="page title">
        T
      </Heading>,
    )
    const el = screen.getByTestId("hp")
    expect(el.id).toBe("pg")
    expect(el.getAttribute("aria-label")).toBe("page title")
  })
})

describe("PageHeader", () => {
  it("renders the title as an h1 plus optional eyebrow, description, action", () => {
    render(
      <PageHeader
        eyebrow="Team"
        title="Members"
        description="Manage who can access this workspace."
        action={<button type="button">Invite</button>}
      />,
    )
    expect(screen.getByRole("heading", { level: 1, name: "Members" })).toBeTruthy()
    expect(screen.getByText("Team")).toBeTruthy()
    expect(
      screen.getByText("Manage who can access this workspace."),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Invite" })).toBeTruthy()
  })

  it("omits the eyebrow and action slots when not provided", () => {
    render(<PageHeader title="Bare" />)
    expect(screen.getByRole("heading", { level: 1, name: "Bare" })).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("SectionTitle", () => {
  it("renders the title as an h2", () => {
    render(<SectionTitle title="Snapshots" />)
    expect(
      screen.getByRole("heading", { level: 2, name: "Snapshots" }),
    ).toBeTruthy()
  })
})

describe("PageShell", () => {
  it("constrains width and merges className", () => {
    const { container } = render(
      <PageShell className="test-class">
        <span>body</span>
      </PageShell>,
    )
    expect(screen.getByText("body")).toBeTruthy()
    expect(container.firstElementChild).toHaveClass(
      "mx-auto",
      "w-full",
      "max-w-6xl",
      "test-class",
    )
  })
})
