import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, FolderOpen } from "lucide-react";
import type { FileNode } from "@tangle-network/ui/files";
import { Button, EmptyState, Input } from "@tangle-network/ui/primitives";
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
  /**
   * `card` (default) sets the tree in its own raised surface under a visible
   * heading. `plain` is for a pane that already names the files, such as a
   * companion tab: the tree sits on the pane's own surface, and the heading is
   * kept for assistive technology only.
   */
  surface?: "card" | "plain";
  /**
   * `split` (default) keeps the tree and the open file side by side, with a resizable sidebar, from 640 px of
   * container width; narrower, and in `stack`, the preview replaces the tree until Back.
   */
  layout?: "split" | "stack";
  className?: string;
  style?: CSSProperties;
};

const SPLIT_MIN_PX = 640;
const SIDEBAR_DEFAULT_PX = 280;
const SIDEBAR_MIN_PX = 200;

interface SidebarWidth {
  width: number;
  min: number;
  max: number;
  set: (px: number) => void;
  reset: () => void;
}

/** The sidebar's width, clamped to 200 px .. half the pane, remembered per viewer under `expansionKey` when given. */
function useSidebarWidth(key: string | undefined, containerWidth: number): SidebarWidth {
  const storageKey = key ? `${key}:sidebar-width` : undefined;
  const [stored, setStored] = useState<number>(() => {
    if (!storageKey) return SIDEBAR_DEFAULT_PX;
    try {
      const value = Number(globalThis.localStorage?.getItem(storageKey));
      return Number.isFinite(value) && value > 0 ? value : SIDEBAR_DEFAULT_PX;
    } catch {
      return SIDEBAR_DEFAULT_PX;
    }
  });
  const max = Math.max(SIDEBAR_MIN_PX, containerWidth > 0 ? Math.floor(containerWidth / 2) : 560);
  const width = Math.min(max, Math.max(SIDEBAR_MIN_PX, stored));
  const save = (px: number) => {
    const next = Math.min(max, Math.max(SIDEBAR_MIN_PX, Math.round(px)));
    setStored(next);
    if (storageKey) try { globalThis.localStorage?.setItem(storageKey, String(next)); } catch { /* private mode keeps it for the session */ }
  };
  return { width, min: SIDEBAR_MIN_PX, max, set: save, reset: () => save(SIDEBAR_DEFAULT_PX) };
}

/** Drag, arrow keys (Shift for larger steps), Home/End, or double-click to reset the sidebar width. */
function SidebarResizer({ sidebar, label }: { sidebar: SidebarWidth; label: string }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label.toLowerCase()} sidebar`}
      aria-valuenow={sidebar.width}
      aria-valuemin={sidebar.min}
      aria-valuemax={sidebar.max}
      tabIndex={0}
      onDoubleClick={sidebar.reset}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16;
        if (event.key === "ArrowLeft") sidebar.set(sidebar.width - step);
        else if (event.key === "ArrowRight") sidebar.set(sidebar.width + step);
        else if (event.key === "Home") sidebar.set(sidebar.min);
        else if (event.key === "End") sidebar.set(sidebar.max);
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        const handle = event.currentTarget;
        const startX = event.clientX;
        const startWidth = sidebar.width;
        handle.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => sidebar.set(startWidth + next.clientX - startX);
        const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
      }}
      className="group relative w-1.5 shrink-0 cursor-col-resize touch-none outline-none"
    >
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </div>
  );
}

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
  surface = "card",
  layout = "split",
  className,
  style,
}: WorkspaceFilesPaneProps) {
  const plain = surface === "plain";
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry!.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Split from 640 px of the pane's own width; before the first measure, assume it fits.
  const split = layout === "split" && (containerWidth === 0 || containerWidth >= SPLIT_MIN_PX);
  const sidebar = useSidebarWidth(expansionKey, containerWidth);
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

  // Focus follows the reader's own open and close. A page that mounts with a file already previewed keeps its
  // scroll and focus: focusing Back on mount scrolled a phone page past its header.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      wasPreviewRef.current = hasPreview;
      return;
    }
    if (split) { wasPreviewRef.current = hasPreview; return; }
    if (hasPreview && !wasPreviewRef.current) backRef.current?.focus({ preventScroll: true });
    if (!hasPreview && wasPreviewRef.current) {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else treeRef.current?.focus({ preventScroll: true });
    }
    wasPreviewRef.current = hasPreview;
  }, [hasPreview, split]);

  return (
    <div ref={rootRef} data-workspace-files-layout={split ? "split" : "stack"}
      className={cn("flex h-full min-h-0 min-w-0", split ? "flex-row" : "flex-col", className)} style={style}>
      {/* Retaining the tree preserves expansion, selection, filter and scroll on return. */}
      <div
        ref={treeRef}
        hidden={!split && hasPreview}
        tabIndex={-1}
        role="region"
        aria-label="Workspace files"
        style={split ? { width: sidebar.width } : undefined}
        className={cn("flex min-h-0 flex-col", split ? "shrink-0" : "flex-1", !plain && "p-2", !split && hasPreview && "hidden")}
      >
        <section
          aria-labelledby={headingId}
          data-workspace-files-surface={surface}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            !plain && "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
          )}
        >
          {plain ? (
            <>
              <h2 id={headingId} className="sr-only">{label}</h2>
              {headerActions && <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-3">{headerActions}</div>}
            </>
          ) : (
            <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
              <h2 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</h2>
              {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
            </div>
          )}
          {search && !isEmpty && (
            <div className={cn("shrink-0 px-3 pb-2", plain && "pt-3")}>
              <Input
                type="search"
                size="sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </div>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5", (!plain || (search && !isEmpty)) && "border-t border-border")}>
            {isEmpty ? (
              emptyState !== undefined ? emptyState : <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="No files yet" />
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="max-w-xs break-words text-xs text-muted-foreground">No files match “{query.trim()}”.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
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
      {split && <SidebarResizer sidebar={sidebar} label={label} />}
      {split && !preview && (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          {isEmpty ? null : "Select a file to open it here."}
        </div>
      )}
      {preview && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2">
            {onBack && !split && (
              <Button
                ref={backRef}
                type="button"
                variant="bare"
                onClick={onBack}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Back to files
              </Button>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={preview.path}>
              {preview.path}
            </span>
            {preview.actions && <div className="flex shrink-0 items-center gap-2">{preview.actions}</div>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-auto [&>*]:min-h-full">{preview.content}</div>
        </div>
      )}
    </div>
  );
}
