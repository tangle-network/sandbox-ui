import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowLeft, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
import { FileTabs, type FileNode } from "@tangle-network/ui/files";
import { Button, EmptyState, Input, SegmentedControl } from "@tangle-network/ui/primitives";
import { cn } from "../lib/utils";
import { VaultTree } from "../vault-tree/vault-tree";
import { fileTreeFromPaths, filterFileNodes } from "../vault-tree/tree-data";

export interface WorkspaceFilesPreview {
  path: string;
  content: ReactNode;
  actions?: ReactNode;
  /** The same file at an earlier point, such as the previous release, usually a DiffView: adds a File | Diff toggle. */
  compare?: { label: string; content: ReactNode };
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
  /** Heading of the files surface, shown in the tree's header row when there is no search field. Defaults to "Files". */
  label?: string;
  /** Controls rendered in the tree's header row. */
  headerActions?: ReactNode;
  /**
   * `card` (default) frames the tree and the open file in one card. `plain`
   * is for a pane that already frames and names the files, such as a companion
   * tab: no border, corner or shadow, and the heading is for assistive
   * technology only.
   */
  surface?: "card" | "plain";
  /**
   * `split` (default) keeps the tree and the open file side by side, with a resizable sidebar, from 640 px of
   * container width; narrower, and in `stack`, the preview replaces the tree until Back.
   */
  layout?: "split" | "stack";
  /** In the split layout, each opened file keeps a tab until closed; closing the open tab opens its neighbour. Defaults to true. */
  tabs?: boolean;
  /** Offer a full-screen toggle; Escape returns. Defaults to true. */
  expandable?: boolean;
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

/**
 * The tree's and the open file's header rows: one height and one chrome plane (the page, a step under the card), so
 * they read as one strip with one baseline. Fields in it take the card plane, as the active tab does.
 */
const HEADER_ROW = "flex h-11 shrink-0 pointer-coarse:h-14 items-center bg-background shadow-[inset_0_-1px_0_hsl(var(--border))] [--field-surface:hsl(var(--card))]";

/**
 * A 1px line below the header row with a 9px invisible hit area. Its negative margin cancels its width, so the header row stays one strip.
 * Drag, arrow keys (Shift for larger steps), Home/End, or double-click to reset the sidebar width.
 */
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
      className="group relative z-10 -mr-px w-px shrink-0 cursor-col-resize touch-none outline-none"
    >
      <span aria-hidden className="absolute bottom-0 left-0 top-11 w-px pointer-coarse:top-14 bg-border transition-colors group-hover:bg-ring group-focus-visible:bg-ring" />
      <span aria-hidden className="absolute bottom-0 -left-1 top-11 w-[9px] pointer-coarse:top-14" />
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
 * One card holds the tree and the open file. Both columns start with a header
 * row of one height on the chrome plane, so the search field and the open-file
 * tabs share one baseline; every inset reads `--files-inset`. Folders start
 * collapsed, expansion is remembered under `expansionKey`, and in the stacked
 * layout a preview replaces the tree until Back.
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
  tabs = true,
  expandable = true,
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
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setExpanded(false);
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [expanded]);
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
  const searchable = search && !isEmpty;
  const normalizedSelection = selectedPath?.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, "");

  // Focus follows the reader's own open and close, never the page's: a preview that arrives from an initial or loaded
  // selectedPath leaves focus and scroll alone (focusing Back on landing scrolled a phone page past its header).
  const mountedRef = useRef(false);
  const openedByReaderRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      wasPreviewRef.current = hasPreview;
      return;
    }
    if (split) { wasPreviewRef.current = hasPreview; return; }
    if (hasPreview && !wasPreviewRef.current && openedByReaderRef.current) backRef.current?.focus({ preventScroll: true });
    openedByReaderRef.current = false;
    if (!hasPreview && wasPreviewRef.current) {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else treeRef.current?.focus({ preventScroll: true });
    }
    wasPreviewRef.current = hasPreview;
  }, [hasPreview, split]);

  return (
    <div ref={rootRef} data-workspace-files-layout={split ? "split" : "stack"} data-expanded={expanded ? "" : undefined}
      className={cn(
        "flex h-full min-h-0 min-w-0 overflow-hidden bg-card text-card-foreground [--files-inset:0.75rem]",
        split ? "flex-row" : "flex-col",
        !plain && "rounded-[var(--radius-lg)] border border-border shadow-[var(--edge-highlight),var(--shadow-card)]",
        className,
        expanded && "fixed inset-0 z-50 h-auto max-h-none w-auto max-w-none rounded-none border-0",
      )}
      style={expanded ? undefined : style}>
      {/* Retaining the tree preserves expansion, selection, filter and scroll on return. */}
      <div
        ref={treeRef}
        hidden={!split && hasPreview}
        tabIndex={-1}
        role="region"
        aria-label="Workspace files"
        style={split ? { width: sidebar.width } : undefined}
        className={cn("flex min-h-0 flex-col outline-none", split ? "shrink-0" : "flex-1", !split && hasPreview && "hidden")}
      >
        <section aria-labelledby={headingId} data-workspace-files-surface={surface} className="flex min-h-0 flex-1 flex-col">
          <div className={cn(HEADER_ROW, "gap-2 px-[var(--files-inset)]")}>
            <h2 id={headingId} className={cn("min-w-0 flex-1 truncate text-sm font-medium text-foreground", (plain || searchable) && "sr-only")}>{label}</h2>
            {searchable && (
              <Input
                type="search"
                size="sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
                className="min-w-0 flex-1"
              />
            )}
            {headerActions && <div className="ml-auto flex shrink-0 items-center gap-1">{headerActions}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-[calc(var(--files-inset)_-_0.25rem)] py-2">
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
                  openedByReaderRef.current = true;
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
      {(split || preview) && (
        <FilesViewer
          preview={preview}
          split={split}
          tabs={split && tabs}
          empty={isEmpty}
          backRef={backRef}
          onBack={onBack}
          onOpen={(path) => onSelect?.(path, index.get(path))}
          expand={expandable ? { expanded, toggle: () => setExpanded((value) => !value) } : undefined}
        />
      )}
    </div>
  );
}

interface FilesViewerProps {
  preview?: WorkspaceFilesPreview;
  split: boolean;
  tabs: boolean;
  empty: boolean;
  backRef: RefObject<HTMLButtonElement | null>;
  onBack?: () => void;
  onOpen: (path: string) => void;
  expand?: { expanded: boolean; toggle: () => void };
}

const baseName = (path: string) => path.replace(/\/+$/, "").split("/").pop() || path;

/** The editor side of the pane: open-file tabs, a File | Diff toggle, the full-screen control, and the open file. */
function FilesViewer({ preview, split, tabs, empty, backRef, onBack, onOpen, expand }: FilesViewerProps) {
  const path = preview?.path;
  const [open, setOpen] = useState<string[]>(() => (path ? [path] : []));
  useEffect(() => {
    if (path) setOpen((paths) => (paths.includes(path) ? paths : [...paths, path]));
  }, [path]);
  const [mode, setMode] = useState<"file" | "diff">("file");
  useEffect(() => setMode("file"), [path]);
  const close = (target: string) => {
    const at = open.indexOf(target);
    const rest = open.filter((entry) => entry !== target);
    setOpen(rest);
    if (target !== path) return;
    const neighbour = rest[Math.min(at, rest.length - 1)];
    if (neighbour) onOpen(neighbour);
    else onBack?.();
  };
  const compare = preview?.compare;
  const ExpandIcon = expand?.expanded ? Minimize2 : Maximize2;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Stacked, the row has no neighbour to line up with: on a phone the File | Diff toggle wraps under it instead of clipping. */}
      <div className={cn(HEADER_ROW, "sticky top-0 z-10 gap-2 pr-[var(--files-inset)]", !(tabs && open.length > 0) && "pl-[var(--files-inset)]", !split && "h-auto min-h-11 flex-wrap py-1.5 pointer-coarse:h-auto")}>
        {onBack && !split && preview && (
          <Button ref={backRef} type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 shrink-0 gap-1 px-2 text-muted-foreground">
            <ArrowLeft aria-hidden="true" />
            Back to files
          </Button>
        )}
        {tabs && open.length > 0 ? (
          <FileTabs
            tabs={open.map((entry) => ({ id: entry, name: baseName(entry), path: entry }))}
            activeId={path}
            onSelect={onOpen}
            onClose={close}
            className="h-full flex-1 px-[var(--files-inset)]"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={path}>{path && baseName(path)}</span>
        )}
        {compare && (
          <SegmentedControl
            aria-label="View"
            value={mode}
            onValueChange={setMode}
            options={[{ value: "file", label: "File" }, { value: "diff", label: `Diff vs ${compare.label}` }]}
            className={cn("shrink-0 p-0.5 [&>button]:py-1", !split && "order-last")}
          />
        )}
        {preview?.actions && <div className="flex shrink-0 items-center gap-2">{preview.actions}</div>}
        {expand && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={expand.toggle} aria-pressed={expand.expanded}
            aria-label={expand.expanded ? "Exit full screen" : "Full screen"} title={expand.expanded ? "Exit full screen (Esc)" : "Full screen"}
            className="shrink-0 text-muted-foreground">
            <ExpandIcon aria-hidden />
          </Button>
        )}
      </div>
      {preview ? (
        <div data-primary-content="" className="flex min-h-0 flex-1 flex-col overflow-auto [&>*]:min-h-full">
          {mode === "diff" && compare ? compare.content : preview.content}
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          {empty ? null : "Select a file to open it here."}
        </div>
      )}
    </div>
  );
}
