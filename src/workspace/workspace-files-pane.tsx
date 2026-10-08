import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, FolderOpen } from "lucide-react";
import type { FileNode } from "@tangle-network/ui/files";
import { EmptyState } from "@tangle-network/ui/primitives";
import { focusRing } from "@tangle-network/ui/utils";
import { cn } from "../lib/utils";
import { VaultTree } from "../vault-tree/vault-tree";
import { fileTreeFromPaths, filterFileNodes } from "../vault-tree/tree-data";

export interface WorkspaceFilesPreview {
  path: string;
  content: ReactNode;
  actions?: ReactNode;
}

type WorkspaceFilesSource =
  | { root: FileNode; paths?: never }
  | { paths: ReadonlyArray<string>; root?: never };

export type WorkspaceFilesPaneProps = WorkspaceFilesSource & {
  /** The open file. Its row is selected and its folders are revealed when it changes. */
  selectedPath?: string;
  /**
   * Called when the reader opens a file, and on every folder row click (the
   * folder also expands or collapses). A folder's path carries a trailing `/`,
   * as it did when this pane rendered RichFileTree; check `node.type` to tell
   * them apart.
   */
  onSelect?: (path: string, node?: FileNode) => void;
  preview?: WorkspaceFilesPreview;
  onBack?: () => void;
  /** Supply loading, unavailable, or empty content from the authoritative adapter. */
  emptyState?: ReactNode;
  /**
   * Remembers which folders the reader expanded, in this browser, under this
   * key. The vault page's `treeStateKey` names the same store, so passing the
   * same key keeps one expansion across both. Omit to forget on unmount.
   */
  expansionKey?: string;
  /** Show a name filter above the tree. Defaults to true. */
  search?: boolean;
  /** Heading of the files surface. Defaults to "Files". */
  label?: string;
  /** Controls rendered in the files surface header. */
  headerActions?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function indexNodes(nodes: ReadonlyArray<FileNode>): Map<string, FileNode> {
  const index = new Map<string, FileNode>();
  const visit = (node: FileNode) => {
    index.set(node.path, node);
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return index;
}

function activeElementWithin(element: HTMLElement): HTMLElement | null {
  let active = element.ownerDocument.activeElement;
  if (!element.contains(active)) return null;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : null;
}

/**
 * Compact file navigation shared by workspace companions and standalone panes.
 * The tree sits in its own surface: folders start collapsed, expansion is
 * remembered under `expansionKey`, and a preview replaces the tree until Back.
 */
export function WorkspaceFilesPane({
  root,
  paths,
  selectedPath,
  onSelect,
  preview,
  onBack,
  emptyState,
  expansionKey,
  search = true,
  label = "Files",
  headerActions,
  className,
  style,
}: WorkspaceFilesPaneProps) {
  // A root with a path is itself a row (a file, or a named and possibly empty
  // folder); a pathless root is the container whose children are the rows.
  const nodes = useMemo<FileNode[]>(
    () => (root ? (root.path ? [root] : root.children ?? []) : fileTreeFromPaths(paths ?? [])),
    [root, paths],
  );
  const index = useMemo(() => indexNodes(nodes), [nodes]);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterFileNodes(nodes, query), [nodes, query]);
  const treeRoot = useMemo<FileNode>(() => ({ name: label, path: "", type: "directory", children: visible }), [label, visible]);
  const headingId = useId();
  const treeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasPreviewRef = useRef(false);
  const hasPreview = preview !== undefined;
  const isEmpty = nodes.length === 0;
  const normalizedSelection = selectedPath?.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, "");

  useEffect(() => {
    if (hasPreview && !wasPreviewRef.current) backRef.current?.focus();
    if (!hasPreview && wasPreviewRef.current) {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus();
      else treeRef.current?.focus();
    }
    wasPreviewRef.current = hasPreview;
  }, [hasPreview]);

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col", className)} style={style}>
      {/* Retaining the tree preserves expansion, selection, filter and scroll on return. */}
      <div
        ref={treeRef}
        hidden={hasPreview}
        tabIndex={-1}
        role="region"
        aria-label="Workspace files"
        className={cn("flex min-h-0 flex-1 flex-col p-2", hasPreview && "hidden")}
      >
        <section
          aria-labelledby={headingId}
          data-workspace-files-surface
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
        >
          <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
            <h2 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</h2>
            {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
          </div>
          {search && !isEmpty && (
            <div className="shrink-0 px-3 pb-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-8 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:text-base"
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-1.5 py-1.5">
            {isEmpty ? (
              emptyState !== undefined ? emptyState : <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="No files yet" />
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="max-w-xs break-words text-xs text-muted-foreground">No files match “{query.trim()}”.</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn("inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted", focusRing)}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <VaultTree
                root={treeRoot}
                selectedPath={normalizedSelection}
                onSelect={(path) => {
                  if (treeRef.current) returnFocusRef.current = activeElementWithin(treeRef.current);
                  onSelect?.(path, index.get(path));
                }}
                onFolderSelect={(path) => onSelect?.(`${path}/`, index.get(path))}
                storageKey={expansionKey}
                expandAll={query.trim().length > 0}
                label={label}
              />
            )}
          </div>
        </section>
      </div>
      {preview && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            {onBack && (
              <button
                ref={backRef}
                type="button"
                onClick={onBack}
                className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm text-muted-foreground hover:text-foreground", focusRing)}
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Back to files
              </button>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={preview.path}>
              {preview.path}
            </span>
            {preview.actions && <div className="flex shrink-0 items-center gap-2">{preview.actions}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{preview.content}</div>
        </div>
      )}
    </div>
  );
}
