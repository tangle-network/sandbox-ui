import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { ActivityFeed, type ActivityItem } from "./activity-feed"

const now = 1_700_000_000_000
const items: ActivityItem[] = [
  { id: "a", title: "Older commit", timestamp: now - 60_000 },
  { id: "b", title: "Newest snapshot", detail: "tagged release", timestamp: now },
  { id: "c", title: "Middle event", timestamp: now - 30_000 },
]

describe("ActivityFeed", () => {
  it("renders items newest-first regardless of input order", () => {
    render(<ActivityFeed items={items} />)
    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText("Newest snapshot")).toBeInTheDocument()
    expect(within(rows[1]).getByText("Middle event")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Older commit")).toBeInTheDocument()
  })

  it("renders the optional detail line", () => {
    render(<ActivityFeed items={items} />)
    expect(screen.getByText("tagged release")).toBeInTheDocument()
  })

  it("caps the list at maxItems", () => {
    render(<ActivityFeed items={items} maxItems={2} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByText("Older commit")).not.toBeInTheDocument()
  })

  it("shows the empty label when there are no items", () => {
    render(<ActivityFeed items={[]} emptyLabel="Nothing yet" />)
    expect(screen.getByText("Nothing yet")).toBeInTheDocument()
  })

  it("shows skeletons while loading and no rows", () => {
    render(<ActivityFeed items={items} loading />)
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })
})
