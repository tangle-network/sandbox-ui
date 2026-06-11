import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResourceMeter } from "./resource-meter"

function fill(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>("[style*='width']")
  if (!el) throw new Error("meter fill not found")
  return el
}

describe("ResourceMeter", () => {
  it("renders the label", () => {
    render(<ResourceMeter label="CPU" value={42} />)
    expect(screen.getByText("CPU")).toBeInTheDocument()
  })

  it("defaults to a percent readout against max=100", () => {
    render(<ResourceMeter label="CPU" value={42} />)
    expect(screen.getByText("42%")).toBeInTheDocument()
  })

  it("renders value/max with a unit", () => {
    render(<ResourceMeter label="Disk" value={3} max={10} unit="GB" />)
    expect(screen.getByText("3GB/10GB")).toBeInTheDocument()
  })

  it("valueLabel overrides the computed readout", () => {
    render(
      <ResourceMeter
        label="Memory"
        value={1_200_000}
        max={4_000_000}
        valueLabel="1.2 GB / 4 GB"
      />,
    )
    expect(screen.getByText("1.2 GB / 4 GB")).toBeInTheDocument()
    // The percent template must not also appear.
    expect(screen.queryByText("30%")).not.toBeInTheDocument()
  })

  it("clamps the fill to 100% when value exceeds max", () => {
    const { container } = render(
      <ResourceMeter label="CPU" value={250} max={100} />,
    )
    expect(fill(container).style.width).toBe("100%")
  })

  it("clamps the fill to 0% for negative values", () => {
    const { container } = render(
      <ResourceMeter label="CPU" value={-5} max={100} />,
    )
    expect(fill(container).style.width).toBe("0%")
  })

  it("color-codes the bar by utilization", () => {
    const low = render(<ResourceMeter label="CPU" value={10} />)
    expect(fill(low.container).className).toContain("bg-primary")

    const warn = render(<ResourceMeter label="CPU" value={75} />)
    expect(fill(warn.container).className).toContain(
      "bg-[var(--surface-warning-text)]",
    )

    const crit = render(<ResourceMeter label="CPU" value={95} />)
    expect(fill(crit.container).className).toContain("bg-[var(--code-error)]")
  })

  it("treats max=0 as an empty meter without dividing by zero", () => {
    const { container } = render(
      <ResourceMeter label="Disk" value={5} max={0} />,
    )
    expect(fill(container).style.width).toBe("0%")
  })
})
