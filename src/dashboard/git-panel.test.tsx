import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GitPanel, type GitStatusData, type GitCommitData } from "./git-panel"

const cleanStatus: GitStatusData = {
  branch: "main",
  isDirty: false,
  ahead: 0,
  behind: 0,
  staged: [],
  modified: [],
  untracked: [],
}

const log: GitCommitData[] = [
  {
    shortSha: "abc1234",
    message: "feat: add overview panel",
    author: "dev",
    date: "2026-04-01T10:00:00Z",
  },
]

describe("GitPanel", () => {
  it("renders an accessible, height-reserving skeleton while loading", () => {
    const { container } = render(
      <GitPanel status={null} log={[]} loading />,
    )
    // Accessible loading affordance...
    expect(screen.getByText(/loading git info/i)).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    // ...rendered as skeleton placeholders, not a bare one-line spinner, so
    // the panel reserves the loaded layout's height (regression guard for the
    // load-time resize jump).
    expect(
      container.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThanOrEqual(3)
  })

  it("renders the branch and recent commits once loaded", () => {
    render(<GitPanel status={cleanStatus} log={log} />)
    expect(screen.getByText("main")).toBeInTheDocument()
    expect(screen.getByText("feat: add overview panel")).toBeInTheDocument()
  })

  it("shows the empty state when no repository is detected", () => {
    render(<GitPanel status={null} log={[]} />)
    expect(screen.getByText(/no git repository detected/i)).toBeInTheDocument()
  })

  it("calls onRefresh when the refresh control is clicked", async () => {
    const onRefresh = vi.fn()
    render(<GitPanel status={cleanStatus} log={log} onRefresh={onRefresh} />)
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
