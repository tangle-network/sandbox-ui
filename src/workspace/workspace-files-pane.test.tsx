import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { FileNode } from "@tangle-network/ui/files";
import { WorkspaceFilesPane } from "./workspace-files-pane";

const paths = ["campaigns/outreach.md", "campaigns/plan.md", "research/sources.md"];

function treeShadow(container: HTMLElement): ShadowRoot {
  const element = Array.from(container.querySelectorAll("*")).find((node) => node.shadowRoot);
  if (!element?.shadowRoot) throw new Error("Expected the real RichFileTree shadow root");
  return element.shadowRoot;
}

function queryInput(shadow: ShadowRoot): HTMLInputElement {
  const input = shadow.querySelector("input");
  if (!input) throw new Error("Expected native file search");
  return input;
}

describe("WorkspaceFilesPane", () => {
  it("renders the native searchable path tree and preserves it through a preview", async () => {
    function Consumer() {
      const [path, setPath] = useState<string>();
      return <WorkspaceFilesPane
        paths={paths}
        selectedPath={path}
        onSelect={(next) => { if (!next.endsWith("/")) setPath(next); }}
        preview={path ? { path, content: <article>Reviewed output</article>, actions: <button>Download</button> } : undefined}
        onBack={() => setPath(undefined)}
      />;
    }
    const user = userEvent.setup();
    const { container, getByRole, getByText, queryByRole } = render(<Consumer />);
    const shadow = treeShadow(container);
    const search = queryInput(shadow);
    const folder = shadow.querySelector('[data-item-path="research/"]');
    if (!folder) throw new Error("Expected the research folder");
    await user.click(folder);
    await waitFor(() => expect(shadow.querySelector('[data-item-path="research/"]')).toHaveAttribute("aria-expanded", "false"));
    fireEvent.input(search, { target: { value: "outreach" } });
    await waitFor(() => expect(shadow.querySelector('[data-item-path="campaigns/outreach.md"]')).not.toBeNull());
    expect(search.value).toBe("outreach");
    const row = shadow.querySelector('[data-item-path="campaigns/outreach.md"]');
    if (!row) throw new Error(shadow.innerHTML.replace(/<style[\s\S]*?<\/style>/g, ""));
    await user.click(row);
    await waitFor(() => expect(getByText("Reviewed output")).toBeVisible());
    expect(getByRole("button", { name: "Back to files" })).toHaveFocus();
    expect(getByRole("button", { name: "Download" })).toBeVisible();
    expect(container.querySelector('[aria-label="Workspace files"]')).toHaveAttribute("hidden");
    await user.click(getByRole("button", { name: "Back to files" }));
    expect(queryByRole("article")).not.toBeInTheDocument();
    expect(treeShadow(container)).toBe(shadow);
    expect(queryInput(shadow)).toBe(search);
    // Native tree search ends when a result is selected; navigation does not reset the tree.
    expect(search.value).toBe("");
    expect(shadow.querySelector('[data-item-path="research/"]')).toHaveAttribute("aria-expanded", "false");
    const treeRegion = container.querySelector('[aria-label="Workspace files"]');
    expect(treeRegion).not.toHaveAttribute("hidden");
    expect(treeRegion === document.activeElement || treeRegion?.contains(document.activeElement)).toBe(true);
    const sameFile = shadow.querySelector('[data-item-path="campaigns/outreach.md"]');
    if (!sameFile) throw new Error("Expected the previously opened file");
    await user.click(sameFile);
    await waitFor(() => expect(getByText("Reviewed output")).toBeVisible());
    await user.click(getByRole("button", { name: "Back to files" }));
    expect(shadow.activeElement).toBe(sameFile);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(getByText("Reviewed output")).toBeVisible());
  });

  it("retains root node metadata and empty directories", async () => {
    const file: FileNode = { name: "plan.md", path: "campaigns/plan.md", type: "file", size: 64 };
    const root: FileNode = { name: "workspace", path: "", type: "directory", children: [
      { name: "campaigns", path: "campaigns", type: "directory", children: [file] },
      { name: "drafts", path: "drafts", type: "directory", children: [] },
    ] };
    const onSelect = vi.fn();
    const { container } = render(<WorkspaceFilesPane root={root} onSelect={onSelect} />);
    const shadow = treeShadow(container);
    await waitFor(() => expect(shadow.querySelector('[data-item-path="drafts/"]')).not.toBeNull());
    const fileRow = shadow.querySelector('[data-item-path="campaigns/plan.md"]');
    if (!fileRow) throw new Error(shadow.innerHTML.replace(/<style[\s\S]*?<\/style>/g, ""));
    fireEvent.click(fileRow);
    expect(onSelect).toHaveBeenCalledWith("campaigns/plan.md", file);
  });

  it("selects current root metadata after a listing refresh", () => {
    const oldFile: FileNode = { name: "plan.md", path: "plan.md", type: "file", size: 64 };
    const currentFile: FileNode = { ...oldFile, size: 128 };
    const oldCallback = vi.fn();
    const currentCallback = vi.fn();
    const { container, rerender } = render(<WorkspaceFilesPane root={oldFile} onSelect={oldCallback} />);
    rerender(<WorkspaceFilesPane root={currentFile} onSelect={currentCallback} />);
    const fileRow = treeShadow(container).querySelector('[data-item-path="plan.md"]');
    if (!fileRow) throw new Error("Expected the refreshed file");
    fireEvent.click(fileRow);
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

  it("keeps a named empty directory instead of replacing it with an empty state", async () => {
    const { container, queryByText } = render(<WorkspaceFilesPane root={{ name: "drafts", path: "drafts", type: "directory" }} />);
    await waitFor(() => expect(treeShadow(container).querySelector('[data-item-path="drafts/"]')).not.toBeNull());
    expect(queryByText("No files yet")).not.toBeInTheDocument();
  });
});
