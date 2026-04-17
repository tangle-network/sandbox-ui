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
  it("renders all options as radio buttons", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(3)
    expect(screen.getByText("All")).toBeInTheDocument()
    expect(screen.getByText("Personal")).toBeInTheDocument()
    expect(screen.getByText("Team")).toBeInTheDocument()
  })

  it("marks the active option with aria-checked", () => {
    render(
      <SegmentedControl value="personal" onValueChange={vi.fn()} options={options} />,
    )
    const personalRadio = screen.getByRole("radio", { name: "Personal" })
    const allRadio = screen.getByRole("radio", { name: "All" })

    expect(personalRadio).toHaveAttribute("aria-checked", "true")
    expect(allRadio).toHaveAttribute("aria-checked", "false")
  })

  it("sets tabIndex 0 on active option and -1 on inactive options", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios[0]).toHaveAttribute("tabindex", "0")
    expect(radios[1]).toHaveAttribute("tabindex", "-1")
    expect(radios[2]).toHaveAttribute("tabindex", "-1")
  })

  it("calls onValueChange when clicking an inactive option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    await user.click(screen.getByRole("radio", { name: "Team" }))
    expect(onChange).toHaveBeenCalledWith("team")
  })

  it("does not call onValueChange when clicking the already-active option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    await user.click(screen.getByRole("radio", { name: "All" }))
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

  it("navigates to next option on ArrowRight", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("personal")
  })

  it("moves DOM focus to the target option on arrow key", async () => {
    const user = userEvent.setup()
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )

    const personalRadio = screen.getByRole("radio", { name: "Personal" })
    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{ArrowRight}")

    expect(document.activeElement).toBe(personalRadio)
  })

  it("navigates to previous option on ArrowLeft", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="personal" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "Personal" }).focus()
    await user.keyboard("{ArrowLeft}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("wraps around on ArrowRight from last option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="team" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "Team" }).focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("wraps around on ArrowLeft from first option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{ArrowLeft}")

    expect(onChange).toHaveBeenCalledWith("team")
  })

  it("navigates to first option on Home", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="team" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "Team" }).focus()
    await user.keyboard("{Home}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("navigates to last option on End", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{End}")

    expect(onChange).toHaveBeenCalledWith("team")
  })

  it("does not fire onValueChange when Home is pressed on first option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{Home}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not fire onValueChange when End is pressed on last option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="team" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "Team" }).focus()
    await user.keyboard("{End}")

    expect(onChange).not.toHaveBeenCalled()
  })

  // --- Edge cases ---

  it("does not crash on keyboard input when options array is empty", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(
      <SegmentedControl value="all" onValueChange={onChange} options={[]} />,
    )

    const radiogroup = container.querySelector("[role='radiogroup']") as HTMLElement
    radiogroup.focus()
    await user.keyboard("{ArrowRight}")
    await user.keyboard("{Home}")
    await user.keyboard("{End}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("gives first option tabIndex 0 when value does not match any option", () => {
    render(
      <SegmentedControl value={"unknown" as string} onValueChange={vi.fn()} options={options} />,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios[0]).toHaveAttribute("tabindex", "0")
    expect(radios[1]).toHaveAttribute("tabindex", "-1")
    expect(radios[2]).toHaveAttribute("tabindex", "-1")
  })

  it("navigates from first option when value does not match any option", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value={"unknown" as string} onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("personal")
  })

  it("supports ArrowDown as alias for ArrowRight", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="all" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "All" }).focus()
    await user.keyboard("{ArrowDown}")

    expect(onChange).toHaveBeenCalledWith("personal")
  })

  it("supports ArrowUp as alias for ArrowLeft", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl value="personal" onValueChange={onChange} options={options} />,
    )

    screen.getByRole("radio", { name: "Personal" }).focus()
    await user.keyboard("{ArrowUp}")

    expect(onChange).toHaveBeenCalledWith("all")
  })

  // --- Variants ---

  it("applies row variant classes by default", () => {
    render(
      <SegmentedControl value="all" onValueChange={vi.fn()} options={options} />,
    )
    const radiogroup = screen.getByRole("radiogroup")
    expect(radiogroup.className).toContain("flex-wrap")
    expect(radiogroup.className).toContain("rounded-lg")
    expect(radiogroup.className).toContain("bg-card")
  })

  it("applies tabs variant classes with nowrap", () => {
    render(
      <SegmentedControl
        value="all"
        onValueChange={vi.fn()}
        options={options}
        variant="tabs"
      />,
    )
    const radiogroup = screen.getByRole("radiogroup")
    expect(radiogroup.className).toContain("flex-nowrap")
    expect(radiogroup.className).toContain("overflow-x-auto")
    expect(radiogroup.className).toContain("border-b")
    expect(radiogroup.className).not.toContain("bg-card")
  })

  it("passes aria-label to the radiogroup", () => {
    render(
      <SegmentedControl
        value="all"
        onValueChange={vi.fn()}
        options={options}
        aria-label="Scope filter"
      />,
    )
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Scope filter")
  })
})
