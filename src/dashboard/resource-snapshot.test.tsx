import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResourceSnapshot } from "./resource-snapshot"

const items = [
  { label: "CPU", value: 40, max: 100, valueLabel: "40%" },
  { label: "Memory", value: 2, max: 4, valueLabel: "2 GB / 4 GB" },
]

describe("ResourceSnapshot", () => {
  it("renders the title, action, and one meter per item", () => {
    render(
      <ResourceSnapshot
        title="Resources"
        action={<a href="#metrics">View metrics</a>}
        items={items}
      />,
    )
    expect(screen.getByText("Resources")).toBeInTheDocument()
    expect(screen.getByText("View metrics")).toBeInTheDocument()
    expect(screen.getByText("CPU")).toBeInTheDocument()
    expect(screen.getByText("2 GB / 4 GB")).toBeInTheDocument()
  })

  it("renders an error line instead of meters when error is set", () => {
    render(<ResourceSnapshot items={items} error="Metrics unavailable" />)
    expect(screen.getByText("Metrics unavailable")).toBeInTheDocument()
    expect(screen.queryByText("CPU")).not.toBeInTheDocument()
  })

  it("shows skeletons while loading and no meters", () => {
    render(<ResourceSnapshot items={items} loading />)
    expect(screen.queryByText("CPU")).not.toBeInTheDocument()
  })

  it("renders items that share a label when given distinct ids", () => {
    render(
      <ResourceSnapshot
        items={[
          { id: "disk-root", label: "Disk", value: 1, max: 4, valueLabel: "1 GB / 4 GB" },
          { id: "disk-data", label: "Disk", value: 3, max: 8, valueLabel: "3 GB / 8 GB" },
        ]}
      />,
    )
    expect(screen.getAllByText("Disk")).toHaveLength(2)
    expect(screen.getByText("1 GB / 4 GB")).toBeInTheDocument()
    expect(screen.getByText("3 GB / 8 GB")).toBeInTheDocument()
  })

  it("renders duplicate labels without ids via the index fallback", () => {
    render(
      <ResourceSnapshot
        items={[
          { label: "Disk", value: 1, max: 4, valueLabel: "root" },
          { label: "Disk", value: 3, max: 8, valueLabel: "data" },
        ]}
      />,
    )
    expect(screen.getAllByText("Disk")).toHaveLength(2)
    expect(screen.getByText("root")).toBeInTheDocument()
    expect(screen.getByText("data")).toBeInTheDocument()
  })

  it("forwards unit to ResourceMeter when valueLabel is omitted", () => {
    render(
      <ResourceSnapshot
        items={[{ label: "Disk", value: 3, max: 10, unit: "GB" }]}
      />,
    )
    expect(screen.getByText("3GB/10GB")).toBeInTheDocument()
  })
})
