import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { FileNode } from "@tangle-network/ui/files";
import { WorkspaceFilesPane } from "./workspace-files-pane";

const paths = ["campaigns/outreach.md", "campaigns/plan.md", "research/sources.md"];

beforeEach(() => window.localStorage.clear());

describe("WorkspaceFilesPane", () => {
  it("starts collapsed in its own surface, filters, previews, and returns to the same tree", async () => {
    function Consumer() {
      const [path, setPath] = useState<string>();
      return <WorkspaceFilesPane
        paths={paths}
        selectedPath={path}
        onSelect={setPath}
        preview={path ? { path, content: <article>Reviewed output</article>, actions: <button>Download</button> } : undefined}
        onBack={() => setPath(undefined)}
      />;
    }
    const user = userEvent.setup();
    const { container, getByRole, getByText, queryByRole } = render(<Consumer />);
    const surface = getByRole("region", { name: "Files" });
    expect(surface).toHaveAttribute("data-workspace-files-surface");
    const tree = within(surface).getByRole("tree");
    expect(within(tree).getByRole("treeitem", { name: "campaigns" })).toHaveAttribute("aria-expanded", "false");
    expect(within(tree).getByRole("treeitem", { name: "research" })).toHaveAttribute("aria-expanded", "false");
    expect(within(tree).queryByRole("treeitem", { name: "outreach.md" })).toBeNull();

    const search = getByRole("searchbox", { name: "Search files" });
    fireEvent.change(search, { target: { value: "outreach" } });
    const row = within(tree).getByRole("treeitem", { name: "outreach.md" });
    expect(within(tree).queryByRole("treeitem", { name: "sources.md" })).toBeNull();
    await user.click(row);
    expect(getByText("Reviewed output")).toBeVisible();
    expect(getByRole("button", { name: "Back to files" })).toHaveFocus();
    expect(getByRole("button", { name: "Download" })).toBeVisible();
    expect(container.querySelector('[aria-label="Workspace files"]')).toHaveAttribute("hidden");

    await user.click(getByRole("button", { name: "Back to files" }));
    expect(queryByRole("article")).not.toBeInTheDocument();
    // The tree, its filter and its focus survive the preview.
    expect((getByRole("searchbox", { name: "Search files" }) as HTMLInputElement).value).toBe("outreach");
    expect(document.activeElement).toBe(getByRole("treeitem", { name: "outreach.md" }));
    await user.keyboard("{Enter}");
    expect(getByText("Reviewed output")).toBeVisible();
  });

  it("expands on click and remembers expansion under expansionKey across a remount", async () => {
    const user = userEvent.setup();
    const first = render(<WorkspaceFilesPane paths={paths} expansionKey="user-1:ws-1" />);
    await user.click(first.getByRole("treeitem", { name: "research" }));
    expect(first.getByRole("treeitem", { name: "research" })).toHaveAttribute("aria-expanded", "true");
    expect(first.getByRole("treeitem", { name: "sources.md" })).toBeVisible();
    first.unmount();

    const second = render(<WorkspaceFilesPane paths={paths} expansionKey="user-1:ws-1" />);
    expect(second.getByRole("treeitem", { name: "research" })).toHaveAttribute("aria-expanded", "true");
    expect(second.getByRole("treeitem", { name: "campaigns" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals only the selected file's folders", () => {
    const { getByRole } = render(<WorkspaceFilesPane paths={paths} selectedPath="research/sources.md" />);
    expect(getByRole("treeitem", { name: "research" })).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("treeitem", { name: "sources.md" })).toHaveAttribute("aria-selected", "true");
    expect(getByRole("treeitem", { name: "campaigns" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reports files with their root metadata and keeps empty directories", async () => {
    const file: FileNode = { name: "plan.md", path: "campaigns/plan.md", type: "file", size: 64 };
    const root: FileNode = { name: "workspace", path: "", type: "directory", children: [
      { name: "campaigns", path: "campaigns", type: "directory", children: [file] },
      { name: "drafts", path: "drafts", type: "directory", children: [] },
    ] };
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(<WorkspaceFilesPane root={root} onSelect={onSelect} />);
    expect(getByRole("treeitem", { name: "drafts" })).toBeVisible();
    await user.click(getByRole("treeitem", { name: "campaigns" }));
    expect(onSelect).toHaveBeenLastCalledWith("campaigns/", root.children![0]);
    await user.click(getByRole("treeitem", { name: "plan.md" }));
    expect(onSelect).toHaveBeenLastCalledWith("campaigns/plan.md", file);
  });

  // The pre-0.130 contract, pinned: agent-dev-container's sandbox workspace
  // forwards every selection that carries a node (`if (node) directory.onSelect(path, node)`),
  // so a folder click must still arrive, with RichFileTree's trailing-slash path,
  // on every click whether it expands, collapses, or the tree is filtered.
  it("reports every folder click with its trailing-slash path and node, as consumers relied on", async () => {
    const forwarded: Array<[string, FileNode["type"]]> = [];
    const directory = { onSelect: (path: string, node: FileNode) => forwarded.push([path, node.type]) };
    const user = userEvent.setup();
    const { getByRole } = render(<WorkspaceFilesPane
      root={{ name: "workspace", path: "", type: "directory", children: [
        { name: "src", path: "src", type: "directory", children: [{ name: "index.ts", path: "src/index.ts", type: "file" }] },
        { name: "notes.txt", path: "notes.txt", type: "file" },
      ] }}
      onSelect={(path, node) => { if (node) directory.onSelect(path, node); }}
    />);
    await user.click(getByRole("treeitem", { name: "src" }));
    await user.click(getByRole("treeitem", { name: "index.ts" }));
    await user.click(getByRole("treeitem", { name: "src" }));
    getByRole("treeitem", { name: "src" }).focus();
    await user.keyboard("{Enter}");
    fireEvent.change(getByRole("searchbox", { name: "Search files" }), { target: { value: "index" } });
    await user.click(getByRole("treeitem", { name: "src" }));
    await user.click(getByRole("treeitem", { name: "index.ts" }));
    expect(forwarded).toEqual([
      ["src/", "directory"],
      ["src/index.ts", "file"],
      ["src/", "directory"],
      ["src/", "directory"],
      ["src/", "directory"],
      ["src/index.ts", "file"],
    ]);
  });

  it("selects current root metadata after a listing refresh", () => {
    const oldFile: FileNode = { name: "plan.md", path: "plan.md", type: "file", size: 64 };
    const currentFile: FileNode = { ...oldFile, size: 128 };
    const oldCallback = vi.fn();
    const currentCallback = vi.fn();
    const { getByRole, rerender } = render(<WorkspaceFilesPane root={oldFile} onSelect={oldCallback} />);
    rerender(<WorkspaceFilesPane root={currentFile} onSelect={currentCallback} />);
    fireEvent.click(getByRole("treeitem", { name: "plan.md" }));
    expect(currentCallback).toHaveBeenCalledWith("plan.md", currentFile);
    expect(oldCallback).not.toHaveBeenCalled();
  });

  it("shows the supplied empty state for an empty virtual workspace", () => {
    const { getByText, queryByText } = render(<WorkspaceFilesPane
      root={{ name: "workspace", path: "", type: "directory", children: [] }}
      emptyState={<p>Upload a source to begin.</p>}
    />);
    expect(getByText("Upload a source to begin.")).toBeVisible();
    expect(queryByText("No files yet")).not.toBeInTheDocument();
  });

  it("honors an explicit null empty state when the adapter reports an unavailable listing", () => {
    const { queryByText } = render(<WorkspaceFilesPane paths={[]} emptyState={null} />);
    expect(queryByText("No files yet")).not.toBeInTheDocument();
  });

  it("keeps a named empty directory instead of replacing it with an empty state", () => {
    const { getByRole, queryByText } = render(<WorkspaceFilesPane root={{ name: "drafts", path: "drafts", type: "directory" }} />);
    expect(getByRole("treeitem", { name: "drafts" })).toBeVisible();
    expect(queryByText("No files yet")).not.toBeInTheDocument();
  });

  it("says when the filter matches nothing and clears it", () => {
    const { getByRole, getByText } = render(<WorkspaceFilesPane paths={paths} />);
    fireEvent.change(getByRole("searchbox", { name: "Search files" }), { target: { value: "zzz" } });
    expect(getByText("No files match “zzz”.")).toBeVisible();
    fireEvent.click(getByRole("button", { name: "Clear search" }));
    expect(getByRole("treeitem", { name: "campaigns" })).toBeVisible();
  });

  it("sits on the host pane with an assistive-only heading when the pane already names it", () => {
    const { getByRole, getByText } = render(<WorkspaceFilesPane paths={paths} surface="plain" headerActions={<button>Refresh</button>} />);
    const surface = getByRole("region", { name: "Files" });
    expect(surface).toHaveAttribute("data-workspace-files-surface", "plain");
    for (const name of ["rounded-xl", "border", "bg-card", "shadow-sm"]) expect(surface).not.toHaveClass(name);
    expect(surface.parentElement).not.toHaveClass("p-2");
    expect(getByText("Files", { selector: "h2" })).toHaveClass("sr-only");
    expect(getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(getByRole("searchbox", { name: "Search files" })).toBeVisible();
  });

  it("keeps its own card surface and visible heading by default", () => {
    const { getByRole, getByText } = render(<WorkspaceFilesPane paths={paths} />);
    expect(getByRole("region", { name: "Files" })).toHaveClass("rounded-xl", "border", "bg-card");
    expect(getByText("Files", { selector: "h2" })).not.toHaveClass("sr-only");
  });
});
