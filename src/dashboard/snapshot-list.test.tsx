import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SnapshotList, type SnapshotInfo } from "./snapshot-list"

const baseSnapshot: SnapshotInfo = {
  id: "snap-abc123def456",
  createdAt: "2026-04-01T10:00:00Z",
  sizeBytes: 1024 * 1024 * 50,
  tags: ["v1"],
}

describe("SnapshotList — onSaveAsTemplate", () => {
  it("renders 'Save as Template' button when onSaveAsTemplate is provided", () => {
    render(
      <SnapshotList
        snapshots={[baseSnapshot]}
        onCreate={vi.fn()}
        onRestore={vi.fn()}
        onSaveAsTemplate={vi.fn()}
      />,
    )

    expect(screen.getByText("Save as Template")).toBeInTheDocument()
  })

  it("does not render 'Save as Template' button when onSaveAsTemplate is omitted", () => {
    render(
      <SnapshotList
        snapshots={[baseSnapshot]}
        onCreate={vi.fn()}
        onRestore={vi.fn()}
      />,
    )

    expect(screen.queryByText("Save as Template")).not.toBeInTheDocument()
  })

  it("calls onSaveAsTemplate with the correct snapshot ID on click", async () => {
    const user = userEvent.setup()
    const onSaveAsTemplate = vi.fn()

    render(
      <SnapshotList
        snapshots={[baseSnapshot]}
        onCreate={vi.fn()}
        onRestore={vi.fn()}
        onSaveAsTemplate={onSaveAsTemplate}
      />,
    )

    await user.click(screen.getByText("Save as Template"))

    expect(onSaveAsTemplate).toHaveBeenCalledWith("snap-abc123def456")
  })
})
