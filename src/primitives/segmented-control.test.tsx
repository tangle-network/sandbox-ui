import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SegmentedControl, type SegmentedControlOption } from "./segmented-control"

const options: SegmentedControlOption[] = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "team", label: "Team" },
]

describe("SegmentedControl", () => {
  it("renders all options as tabs", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(3)
    expect(screen.getByText("All")).toBeInTheDocument()
    expect(screen.getByText("Personal")).toBeInTheDocument()
    expect(screen.getByText("Team")).toBeInTheDocument()
  })

  it("marks the active tab with aria-selected", () => {
    render(
      <SegmentedControl value="personal" onValueChange={vi.fn()} options={options} />,
    )
    const personalTab = screen.getByRole("tab", { name: "Personal" })
    const allTab = screen.getByRole("tab", { name: "All" })

    expect(personalTab).toHaveAttribute("aria-selected", "true")
    expect(allTab).toHaveAttribute("aria-selected", "false")
  })

  it("sets tabIndex 0 on active tab and -1 on inactive tabs", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const tabs = screen.getAllByRole("tab")
    expect(tabs[0]).toHaveAttribute("tabindex", "0")
    expect(tabs[1]).toHaveAttribute("tabindex", "-1")
    expect(tabs[2]).toHaveAttribute("tabindex", "-1")
  })

  it("calls onValueChange when clicking an inactive tab", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    await user.click(screen.getByRole("tab", { name: "Team" }))
    expect(onChange).toHaveBeenCalledWith("team")
  })

  it("does not call onValueChange when clicking the already-active tab", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    await user.click(screen.getByRole("tab", { name: "All" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders adornment when provided", () => {
    const withAdornment: SegmentedControlOption[] = [
      { value: "all", label: "All", adornment: <span data-testid="count">42</span> },
      { value: "personal", label: "Personal" },
    ]
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={withAdornment} />,
    )
    expect(screen.getByTestId("count")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  // --- Keyboard navigation ---

  it("navigates to next tab on ArrowRight", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "All" })
    activeTab.focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("personal")
  })

  it("moves DOM focus to the target tab on arrow key", async () => {
    const user = userEvent.setup()
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )

    const allTab = screen.getByRole("tab", { name: "All" })
    const personalTab = screen.getByRole("tab", { name: "Personal" })
    allTab.focus()
    await user.keyboard("{ArrowRight}")

    expect(document.activeElement).toBe(personalTab)
  })

  it("navigates to previous tab on ArrowLeft", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="personal" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "Personal" })
    activeTab.focus()
    await user.keyboard("{ArrowLeft}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("wraps around on ArrowRight from last tab", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="team" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "Team" })
    activeTab.focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("wraps around on ArrowLeft from first tab", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "All" })
    activeTab.focus()
    await user.keyboard("{ArrowLeft}")

    expect(onChange).toHaveBeenCalledWith("team")
  })

  it("navigates to first tab on Home", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="team" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "Team" })
    activeTab.focus()
    await user.keyboard("{Home}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("navigates to last tab on End", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    const activeTab = screen.getByRole("tab", { name: "All" })
    activeTab.focus()
    await user.keyboard("{End}")

    expect(onChange).toHaveBeenCalledWith("team")
  })

  // --- Edge cases ---

  it("does not crash on keyboard input when options array is empty", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(
      <SegmentedControl value="all" onValueChange={onChange} options={[]} />,
    )

    const tablist = container.querySelector("[role='tablist']") as HTMLElement
    tablist.focus()
    await user.keyboard("{ArrowRight}")
    await user.keyboard("{Home}")
    await user.keyboard("{End}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not fire onValueChange when value is not in options", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value={"unknown" as string} onValueChange={onChange} options={options} />,
    )

    const firstTab = screen.getByRole("tab", { name: "All" })
    firstTab.focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).not.toHaveBeenCalled()
  })

  // --- Variants ---

  it("applies row variant classes by default", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const tablist = screen.getByRole("tablist")
    expect(tablist.className).toContain("rounded-lg")
    expect(tablist.className).toContain("bg-card")
  })

  it("applies tabs variant classes when specified", () => {
    render(
      <SegmentedControl
        value="all"
        onValueChange={vi.fn()}
        options={options}
        variant="tabs"
      />,
    )
    const tablist = screen.getByRole("tablist")
    expect(tablist.className).toContain("border-b")
    expect(tablist.className).not.toContain("bg-card")
  })

  it("passes aria-label to the tablist", () => {
    render(
      <SegmentedControl
        value="all"
        onValueChange={vi.fn()}
        options={options}
        aria-label="Scope filter"
      />,
    )
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Scope filter")
  })
})
