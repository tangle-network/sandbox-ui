import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { RichFileTree, type FileNode, type RichFileTreeProps } from "@tangle-network/ui/files";
import { EmptyState } from "@tangle-network/ui/primitives";
import { focusRing } from "@tangle-network/ui/utils";
import { cn } from "../lib/utils";

export interface WorkspaceFilesPreview {
  path: string;
  content: ReactNode;
  actions?: ReactNode;
}

type WorkspaceFilesSource =
  | { root: FileNode; paths?: never }
  | { paths: ReadonlyArray<string>; root?: never };

export type WorkspaceFilesPaneProps = Omit<
  RichFileTreeProps,
  "root" | "paths" | "onSelect" | "className"
> & WorkspaceFilesSource & {
  /** Root inputs preserve the original node. Flat path inputs have no node metadata. */
  onSelect?: (path: string, node?: FileNode) => void;
  preview?: WorkspaceFilesPreview;
  onBack?: () => void;
  /** Supply loading, unavailable, or empty content from the authoritative adapter. */
  emptyState?: ReactNode;
  className?: string;
};

function indexNodes(root: FileNode | undefined): Map<string, FileNode> {
  const nodes = new Map<string, FileNode>();
  function visit(node: FileNode) {
    nodes.set(node.path.replace(/\/$/, ""), node);
    node.children?.forEach(visit);
  }
  if (root) visit(root);
  return nodes;
}

function activeElementWithin(element: HTMLElement): HTMLElement | null {
  let active = element.ownerDocument.activeElement;
  if (!element.contains(active)) return null;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : null;
}

/** Compact file navigation shared by workspace companions and standalone panes. */
export function WorkspaceFilesPane({
  root,
  paths,
  onSelect,
  preview,
  onBack,
  emptyState,
  className,
  ...treeProps
}: WorkspaceFilesPaneProps) {
  const nodes = useMemo(() => indexNodes(root), [root]);
  const treeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasPreviewRef = useRef(false);
  const hasPreview = preview !== undefined;
  // An empty directory with a path is meaningful and must remain browsable.
  const isEmpty = root
    ? !root.path && root.type === "directory" && !root.children?.length
    : paths?.length === 0;

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
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col bg-background", className)}>
      {/* Retaining the tree preserves expansion, selection, and scroll on return. */}
      <div
        ref={treeRef}
        hidden={hasPreview}
        tabIndex={-1}
        role="region"
        aria-label="Workspace files"
        className={cn("min-h-0 flex-1", hasPreview && "hidden")}
      >
        {isEmpty ? (
          emptyState !== undefined ? emptyState : <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="No files yet" />
        ) : (
          <RichFileTree
            {...treeProps}
            root={root}
            paths={paths}
            onSelect={(path) => {
              if (treeRef.current) returnFocusRef.current = activeElementWithin(treeRef.current);
              onSelect?.(path, nodes.get(path.replace(/\/$/, "")));
            }}
            className="h-full"
          />
        )}
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
