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
})
