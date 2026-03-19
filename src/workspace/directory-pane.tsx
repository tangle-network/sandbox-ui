import { useMemo, useState } from "react";
import { RefreshCw, Search, Upload } from "lucide-react";
import { ArtifactPane } from "./artifact-pane";
import {
  FileTree,
  filterFileTree,
  type FileNode,
  type FileTreeVisibilityOptions,
} from "../files/file-tree";
import { EmptyState } from "../primitives/empty-state";
import { Input } from "../primitives/input";

export interface DirectoryPaneProps {
  root: FileNode;
  selectedPath?: string;
  onSelect?: (path: string, node: FileNode) => void;
  onRefresh?: () => void;
  onUpload?: () => void;
  title?: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  searchPlaceholder?: string;
  visibility?: FileTreeVisibilityOptions;
  className?: string;
}

function countNodes(node: FileNode): { files: number; directories: number } {
  if (node.type === "file") {
    return { files: 1, directories: 0 };
  }

  return (node.children ?? []).reduce(
    (totals, child) => {
      const counts = countNodes(child);
      return {
        files: totals.files + counts.files,
        directories: totals.directories + counts.directories,
      };
    },
    { files: 0, directories: 1 },
  );
}

function filterTree(node: FileNode, query: string): FileNode | null {
  if (!query) return node;

  const normalized = query.trim().toLowerCase();
  const matches = node.name.toLowerCase().includes(normalized) || node.path.toLowerCase().includes(normalized);

  if (node.type === "file") {
    return matches ? node : null;
  }

  const filteredChildren = (node.children ?? [])
    .map((child) => filterTree(child, normalized))
    .filter((child): child is FileNode => child !== null);

  if (matches || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren,
    };
  }

  return null;
}

/**
 * DirectoryPane — searchable file-system navigation surface for sandbox
 * sessions.
 */
export function DirectoryPane({
  root,
  selectedPath,
  onSelect,
  onRefresh,
  onUpload,
  title = "Directory",
  subtitle,
  defaultExpanded = true,
  searchPlaceholder = "Search files and folders…",
  visibility,
  className,
}: DirectoryPaneProps) {
  const [query, setQuery] = useState("");

  const visibleRoot = useMemo(() => filterFileTree(root, visibility), [root, visibility]);
  const filteredRoot = useMemo(
    () => (visibleRoot ? filterTree(visibleRoot, query) : null),
    [query, visibleRoot],
  );
  const counts = useMemo(() => (visibleRoot ? countNodes(visibleRoot) : { files: 0, directories: 0 }), [visibleRoot]);

  return (
    <ArtifactPane
      eyebrow="Workspace"
      title={title}
      subtitle={subtitle ?? root.path}
      className={className}
      toolbar={
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9"
            />
          </div>
          {onRefresh && (
            <button
              type="button"
              aria-label="Refresh directory"
              onClick={onRefresh}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {onUpload && (
            <button
              type="button"
              aria-label="Upload files"
              onClick={onUpload}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <Upload className="h-4 w-4" />
            </button>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{counts.files} files</span>
          <span>{Math.max(counts.directories - 1, 0)} folders</span>
        </div>
      }
      emptyState={
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No matching files"
          description="Try a different search or clear the current filter."
        />
      }
    >
      {filteredRoot ? (
        <div className="p-3">
          <FileTree
            root={filteredRoot}
            selectedPath={selectedPath}
            onSelect={onSelect}
            defaultExpanded={defaultExpanded}
            visibility={visibility}
          />
        </div>
      ) : null}
    </ArtifactPane>
  );
}
