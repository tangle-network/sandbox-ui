import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChangesPane } from "./changes-pane"
import type { ChangedFile } from "./types"

// The diff renderer is `@pierre/diffs` behind `DiffView`; what the pane owns
// is WHICH two texts reach it. The stub records the props so each case can
// assert the baseline / current pairing without rendering Shiki in jsdom.
const diffViewSpy = vi.fn()
vi.mock("./diff-view", () => ({
  DiffView: (props: { filename: string; baseline: string; current: string }) => {
    diffViewSpy(props)
    return <div data-testid="diff-view">{props.filename}</div>
  },
}))

const FILES: ChangedFile[] = [
  { path: "src/lib/retry.ts", status: "modified", additions: 14, deletions: 5, baseline: "a\nb\nq\nr\n", current: "a\nc\nd\ne\n" },
  { path: "src/lib/backoff.ts", status: "added", additions: 7, deletions: 0, current: "export const x = 1\n" },
  { path: "src/lib/sleep.ts", status: "modified", additions: 2, deletions: 2 },
  { path: "src/legacy/poll.ts", status: "deleted", additions: 0, deletions: 11, baseline: "old\n" },
  { path: "README.md", status: "modified", additions: 6, deletions: 1 },
]

function renderPane(overrides: Partial<React.ComponentProps<typeof ChangesPane>> = {}) {
  return render(<ChangesPane branch="feat/retry" files={FILES} {...overrides} />)
}

describe("ChangesPane list", () => {
  it("renders one row per file with its stats and status badge", () => {
    renderPane({ ahead: 2, behind: 1 })

    const list = screen.getByRole("listbox", { name: "Changed files" })
    const rows = within(list).getAllByRole("option")
    expect(rows).toHaveLength(FILES.length)

    // Directory and basename are split so the eye lands on the file.
    expect(within(rows[0]!).getByText("src/lib/")).toBeInTheDocument()
    expect(within(rows[0]!).getByText("retry.ts")).toBeInTheDocument()
    expect(within(rows[0]!).getByText("Modified")).toBeInTheDocument()
    expect(within(rows[0]!).getByText("+14")).toBeInTheDocument()
    expect(within(rows[0]!).getByText("-5")).toBeInTheDocument()

    expect(within(rows[1]!).getByText("Added")).toBeInTheDocument()
    expect(within(rows[3]!).getByText("Deleted")).toBeInTheDocument()
    // A root-level file has no directory part.
    expect(within(rows[4]!).queryByText("/")).toBeNull()
    expect(within(rows[4]!).getByText("README.md")).toBeInTheDocument()

    // Header: branch pill, upstream counts, and the summed totals.
    expect(screen.getByText("feat/retry")).toBeInTheDocument()
    expect(screen.getByLabelText("2 ahead")).toHaveTextContent("↑2")
    expect(screen.getByLabelText("1 behind")).toHaveTextContent("↓1")
    expect(screen.getByText("+29")).toBeInTheDocument()
    expect(screen.getByText("-19")).toBeInTheDocument()
  })

  it("hides the upstream counts at zero and shows the refresh control only when wired", () => {
    const onRefresh = vi.fn()
    const { rerender } = renderPane({ ahead: 0, behind: 0 })
    expect(screen.queryByLabelText(/ahead/)).toBeNull()
    expect(screen.queryByLabelText(/behind/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull()

    rerender(<ChangesPane branch="feat/retry" files={FILES} onRefresh={onRefresh} />)
    screen.getByRole("button", { name: "Refresh" }).click()
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it("selects a file on click", async () => {
    const onSelectFile = vi.fn()
    renderPane({ onSelectFile })
    await userEvent.click(screen.getByText("backoff.ts"))
    expect(onSelectFile).toHaveBeenCalledWith("src/lib/backoff.ts")
  })

  it("marks the selected row and moves the selection with the arrow keys", async () => {
    const onSelectFile = vi.fn()
    renderPane({ selectedPath: "src/lib/backoff.ts", onSelectFile })

    const rows = screen.getAllByRole("option")
    expect(rows[1]).toHaveAttribute("aria-selected", "true")
    expect(rows[0]).toHaveAttribute("aria-selected", "false")
    // Roving tabindex: the selected row is the list's one tab stop.
    expect(rows[1]).toHaveAttribute("tabindex", "0")
    expect(rows[0]).toHaveAttribute("tabindex", "-1")

    rows[1]!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onSelectFile).toHaveBeenLastCalledWith("src/lib/sleep.ts")
    await userEvent.keyboard("{ArrowUp}")
    expect(onSelectFile).toHaveBeenLastCalledWith("src/lib/retry.ts")
    await userEvent.keyboard("{End}")
    expect(onSelectFile).toHaveBeenLastCalledWith("README.md")
    await userEvent.keyboard("{Home}")
    expect(onSelectFile).toHaveBeenLastCalledWith("src/lib/retry.ts")
    await userEvent.keyboard("{Enter}")
    expect(onSelectFile).toHaveBeenLastCalledWith("src/lib/backoff.ts")
  })

  it("does not walk past either end of the list", async () => {
    const onSelectFile = vi.fn()
    renderPane({ selectedPath: "README.md", onSelectFile })
    screen.getAllByRole("option")[4]!.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onSelectFile).toHaveBeenLastCalledWith("README.md")
  })

  it("moves focus to the newly selected row only while the list holds focus", () => {
    const { rerender } = renderPane({ selectedPath: "src/lib/retry.ts" })
    const rows = screen.getAllByRole("option")
    rows[0]!.focus()
    rerender(<ChangesPane branch="feat/retry" files={FILES} selectedPath="src/lib/sleep.ts" />)
    expect(document.activeElement).toBe(screen.getAllByRole("option")[2])

    // A selection change while focus is elsewhere leaves focus where it is.
    ;(document.activeElement as HTMLElement).blur()
    rerender(<ChangesPane branch="feat/retry" files={FILES} selectedPath="README.md" />)
    expect(document.activeElement).toBe(document.body)
  })
})

describe("ChangesPane diff", () => {
  it("renders the selected file through DiffView with the resolved contents", () => {
    diffViewSpy.mockClear()
    renderPane({ selectedPath: "src/lib/retry.ts" })

    expect(screen.getByTestId("diff-view")).toHaveTextContent("src/lib/retry.ts")
    expect(diffViewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filename: "src/lib/retry.ts",
        baseline: "a\nb\nq\nr\n",
        current: "a\nc\nd\ne\n",
        // The pane's PanelHeader names the file; the renderer's own header is off.
        showFileHeader: false,
      }),
    )
    // PanelHeader: the file, its badge, and counts computed from the contents.
    expect(screen.getAllByText("Modified").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("+3")).toBeInTheDocument()
    expect(screen.getByText("-3")).toBeInTheDocument()
  })

  it("diffs an added file against the empty string", () => {
    diffViewSpy.mockClear()
    renderPane({ selectedPath: "src/lib/backoff.ts" })
    expect(diffViewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseline: "", current: "export const x = 1\n" }),
    )
  })

  it("diffs a deleted file against an empty working copy", () => {
    diffViewSpy.mockClear()
    renderPane({ selectedPath: "src/legacy/poll.ts" })
    expect(diffViewSpy).toHaveBeenLastCalledWith(expect.objectContaining({ baseline: "old\n", current: "" }))
  })

  it("shows the loading line, under the file's header, until contents resolve", () => {
    diffViewSpy.mockClear()
    const { rerender } = renderPane({ selectedPath: "src/lib/sleep.ts" })

    expect(screen.getByRole("status")).toHaveTextContent("Loading diff…")
    expect(screen.queryByTestId("diff-view")).toBeNull()
    expect(diffViewSpy).not.toHaveBeenCalled()
    // The header is already there so the selection reads as acknowledged.
    expect(screen.getAllByText("src/lib/sleep.ts").length).toBeGreaterThanOrEqual(1)

    const resolved = FILES.map((f) =>
      f.path === "src/lib/sleep.ts" ? { ...f, baseline: "x\n", current: "y\n" } : f,
    )
    rerender(<ChangesPane branch="feat/retry" files={resolved} selectedPath="src/lib/sleep.ts" />)
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByTestId("diff-view")).toBeInTheDocument()
  })

  it("waits for both sides of a modified file before drawing it", () => {
    diffViewSpy.mockClear()
    const half = FILES.map((f) => (f.path === "src/lib/sleep.ts" ? { ...f, current: "y\n" } : f))
    renderPane({ files: half, selectedPath: "src/lib/sleep.ts" })
    expect(screen.getByRole("status")).toHaveTextContent("Loading diff…")
    expect(diffViewSpy).not.toHaveBeenCalled()
  })

  it("offers Open on the header when the host can open files", async () => {
    const onOpenFile = vi.fn()
    renderPane({ selectedPath: "src/lib/retry.ts", onOpenFile })
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(onOpenFile).toHaveBeenCalledWith("src/lib/retry.ts")
  })

  it("prompts for a selection when none is made", () => {
    renderPane()
    expect(screen.getByText("Select a file to read its diff.")).toBeInTheDocument()
  })
})

describe("ChangesPane commit", () => {
  it("keeps Commit disabled without files, without a message, or while busy", async () => {
    const onCommit = vi.fn(async () => {})
    const { rerender } = render(<ChangesPane branch="main" files={[]} onCommit={onCommit} />)
    const commit = () => screen.getByRole("button", { name: /commit/i })
    expect(commit()).toBeDisabled()

    rerender(<ChangesPane branch="main" files={FILES} onCommit={onCommit} />)
    expect(commit()).toBeDisabled()

    await userEvent.type(screen.getByRole("textbox", { name: "Commit message" }), "   ")
    expect(commit()).toBeDisabled()

    await userEvent.type(screen.getByRole("textbox", { name: "Commit message" }), "feat: retry")
    expect(commit()).toBeEnabled()

    rerender(<ChangesPane branch="main" files={FILES} onCommit={onCommit} busy="push" />)
    expect(commit()).toBeDisabled()
  })

  it("commits the trimmed message and clears the box on success", async () => {
    const onCommit = vi.fn(async () => {})
    renderPane({ onCommit })
    const box = screen.getByRole("textbox", { name: "Commit message" })
    await userEvent.type(box, "  feat: exponential backoff  ")
    await userEvent.click(screen.getByRole("button", { name: /commit/i }))

    expect(onCommit).toHaveBeenCalledWith("feat: exponential backoff")
    await waitFor(() => expect(box).toHaveValue(""))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("commits on Cmd/Ctrl+Enter from the message box", async () => {
    const onCommit = vi.fn(async () => {})
    renderPane({ onCommit })
    const box = screen.getByRole("textbox", { name: "Commit message" })
    await userEvent.type(box, "feat: retry")
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}")
    expect(onCommit).toHaveBeenCalledWith("feat: retry")
  })

  it("shows the rejection inline and keeps the message", async () => {
    const onCommit = vi.fn(async () => {
      throw new Error("pre-commit hook failed: lint reported 2 errors")
    })
    renderPane({ onCommit })
    const box = screen.getByRole("textbox", { name: "Commit message" })
    await userEvent.type(box, "feat: retry")
    await userEvent.click(screen.getByRole("button", { name: /commit/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("pre-commit hook failed: lint reported 2 errors")
    expect(box).toHaveValue("feat: retry")
  })

  it("spins the in-flight action and disables the other", () => {
    renderPane({ onCommit: async () => {}, onPush: async () => {}, ahead: 1, busy: "commit" })
    const commit = screen.getByRole("button", { name: /commit/i })
    expect(commit).toBeDisabled()
    expect(within(commit).getByTitle("Loading spinner")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /push/i })).toBeDisabled()
  })

  it("renders no footer when neither action is wired", () => {
    renderPane()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: /commit/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /push/i })).toBeNull()
  })
})

describe("ChangesPane push", () => {
  it("is disabled with nothing ahead and enabled once there is", () => {
    const onPush = vi.fn(async () => {})
    const { rerender } = renderPane({ onPush, ahead: 0 })
    expect(screen.getByRole("button", { name: /push/i })).toBeDisabled()

    rerender(<ChangesPane branch="feat/retry" files={FILES} onPush={onPush} ahead={2} />)
    const push = screen.getByRole("button", { name: /push/i })
    expect(push).toBeEnabled()
    expect(push).toHaveTextContent("↑2")
  })

  it("pushes and surfaces a rejection inline", async () => {
    const onPush = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("remote: permission denied"))
    renderPane({ onPush, ahead: 2 })

    await userEvent.click(screen.getByRole("button", { name: /push/i }))
    expect(onPush).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole("button", { name: /push/i })).toBeEnabled())
    expect(screen.queryByRole("alert")).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /push/i }))
    expect(await screen.findByRole("alert")).toHaveTextContent("remote: permission denied")
  })
})

describe("ChangesPane states", () => {
  it("shows one sentence for a clean tree", () => {
    renderPane({ files: [] })
    expect(screen.getByText("No changes in the working tree.")).toBeInTheDocument()
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("renders skeleton rows while loading", () => {
    const { container } = render(<ChangesPane branch={null} files={[]} loading />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText("Loading changes…")).toBeInTheDocument()
    expect(screen.queryByText("No changes in the working tree.")).toBeNull()
    // The branch slot is a placeholder too, not a premature "no commits yet".
    expect(screen.queryByText("no commits yet")).toBeNull()
  })

  it("reads a null branch as no commits yet", () => {
    renderPane({ branch: null })
    expect(screen.getByText("no commits yet")).toBeInTheDocument()
  })

  it("shows the status error inline and keeps whatever rows it has", () => {
    renderPane({ error: "git status: not a git repository" })
    expect(screen.getByRole("alert")).toHaveTextContent("git status: not a git repository")
    expect(screen.getAllByRole("option")).toHaveLength(FILES.length)
    expect(screen.queryByText("No changes in the working tree.")).toBeNull()
  })
})
