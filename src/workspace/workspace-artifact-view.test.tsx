import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceArtifactView } from "./workspace-artifact-view";
import { WorkspaceFilesPane } from "./workspace-files-pane";

describe("WorkspaceArtifactView", () => {
  it("lets the containing Files pane own a nested path without losing download or content", () => {
    const onDownload = vi.fn();
    const path = "campaigns/notes.txt";
    const { getAllByText, queryByText, getByRole, getByText } = render(
      <WorkspaceFilesPane
        paths={[path]}
        preview={{
          path,
          content: <WorkspaceArtifactView hideTitleBlock artifact={{
            id: path,
            kind: "file",
            path,
            filename: "notes.txt",
            title: "notes.txt",
            content: "A useful campaign note.",
            mimeType: "text/plain",
            onDownload,
          }} />,
        }}
      />,
    );
    expect(getAllByText(path)).toHaveLength(1);
    expect(queryByText("notes.txt", { exact: true })).not.toBeInTheDocument();
    expect(getByText("A useful campaign note.")).toBeVisible();
    fireEvent.click(getByRole("button", { name: "Download notes.txt" }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("preserves a standalone file's existing title and nested path by default", () => {
    const { getByText } = render(<WorkspaceArtifactView artifact={{
      id: "file",
      kind: "file",
      title: "notes.txt",
      filename: "notes.txt",
      path: "campaigns/notes.txt",
      content: "A useful campaign note.",
      mimeType: "text/plain",
    }} />);
    expect(getByText("notes.txt", { exact: true })).toBeVisible();
    expect(getByText("campaigns/notes.txt")).toBeVisible();
  });

  it("hides an embedded document's identity while preserving its actions and body", () => {
    const share = vi.fn();
    const { queryByText, getByText, getByRole } = render(<WorkspaceArtifactView hideTitleBlock artifact={{
      id: "doc",
      kind: "markdown",
      title: "Repeated document title",
      subtitle: "Repeated path",
      content: "The document body.",
      headerActions: <button onClick={share}>Share</button>,
    }} />);
    expect(queryByText("Repeated document title")).not.toBeInTheDocument();
    expect(queryByText("Repeated path")).not.toBeInTheDocument();
    expect(getByText("The document body.")).toBeVisible();
    fireEvent.click(getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledOnce();
  });
});
