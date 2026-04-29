/**
 * RichFileTree — feature-rich file browser built on @pierre/trees.
 *
 * Why this exists alongside the existing FileTree:
 * - Built-in search (cmd-K-style fuzzy filter)
 * - Virtualized rendering for vaults with thousands of files
 * - Git-status overlays per row (modified / added / staged)
 * - Right-click + button-lane context menus with custom item rendering
 * - VS Code-style icons via @pierre/vscode-icons (optional)
 *
 * The existing FileTree stays as-is for simple cases. RichFileTree is the
 * upgrade path when a consumer's vault grows past a few hundred files or
 * needs richer affordances.
 *
 * Pierre renders inside a shadow DOM to keep its CSS isolated. We bridge
 * the host theme via CSS variables on the host element below — the tree
 * picks them up through `--trees-*-override` overrides.
 */

import {
  FileTree as PierreFileTree,
  useFileTree as usePierreFileTree,
} from "@pierre/trees/react";
import type {
  ContextMenuItem,
  ContextMenuOpenContext,
  GitStatus,
  GitStatusEntry,
} from "@pierre/trees";
import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import type { FileNode } from "./file-tree";

/**
 * Re-export Pierre's git-status union under a stable name so consumers
 * don't import directly from the dep. If we ever swap the underlying
 * implementation, only this file changes.
 */
export type RichFileTreeGitStatus = GitStatus;
export type RichFileTreeGitEntry = GitStatusEntry;

export interface RichFileTreeProps {
  /**
   * Either a recursive `FileNode` tree (matches the existing FileTree
   * input) or a flat list of canonical paths. Pass exactly one.
   */
  root?: FileNode;
  paths?: ReadonlyArray<string>;

  /** Currently-selected path. Pierre supports multi-select internally; the
   * wrapper exposes a single string for parity with FileTree. */
  selectedPath?: string;
  /** Called whenever the selection changes (single-select fan-out). */
  onSelect?: (path: string) => void;

  /** Show the inline search input. Defaults to true. */
  search?: boolean;
  /** Open / closed initial expansion. Defaults to "open" — match FileTree. */
  initialExpansion?: "open" | "closed";

  /** Optional git-status decorations per path. */
  gitStatus?: ReadonlyArray<RichFileTreeGitEntry>;

  /**
   * Right-click / button-lane menu content. Receives the row and the
   * trigger context (which interaction opened the menu).
   */
  renderContextMenu?: (
    item: ContextMenuItem,
    context: ContextMenuOpenContext,
  ) => ReactNode;

  /** Optional header rendered above the tree rows. */
  header?: ReactNode;

  /**
   * Theme override map for shadow-DOM CSS variables. Most consumers can
   * leave this — defaults derive from the host element's computed
   * tokens via `cssVarFromToken()`.
   */
  themeOverrides?: Partial<RichFileTreeThemeVars>;

  className?: string;
  style?: CSSProperties;
  /** Inline height (or set via `style.height`). Defaults to 100% of parent. */
  height?: number | string;
}

export interface RichFileTreeThemeVars {
  /** Selected-row background. */
  selectedBg: string;
  /** Selected-row foreground. */
  selectedFg: string;
  /** Default row foreground. */
  fg: string;
  /** Hover background. */
  hoverBg: string;
  /** Border / divider color. */
  border: string;
  /** Muted (parent path, breadcrumb) foreground. */
  mutedFg: string;
}

/**
 * Map a sandbox-ui design token (e.g. `--accent-surface-soft`) to a CSS
 * `var(--token)` reference. Pierre's CSS-variable surface accepts any
 * valid CSS color expression, so passing `var(--token)` lets the host
 * theme propagate through without us having to read computed styles.
 */
function cssVarFromToken(name: string): string {
  return `var(${name})`;
}

const DEFAULT_THEME: RichFileTreeThemeVars = {
  selectedBg: cssVarFromToken("--accent-surface-soft"),
  selectedFg: cssVarFromToken("--accent-text"),
  fg: cssVarFromToken("--foreground"),
  hoverBg: cssVarFromToken("--muted"),
  border: cssVarFromToken("--border"),
  mutedFg: cssVarFromToken("--muted-foreground"),
};

/**
 * Walk a recursive FileNode and return a flat list of canonical paths.
 *
 * Pierre infers directory structure from path segments — passing both
 * `dir` and `dir/file.md` collides because `dir` looks like a file.
 * We emit only files; pure-directory leaves get a trailing slash so
 * Pierre keeps them as folders even when they have no children.
 */
function flattenFileNode(node: FileNode, out: string[] = []): string[] {
  if (node.type === "file" && node.path) {
    out.push(node.path);
    return out;
  }
  if (node.type === "directory") {
    if (node.children?.length) {
      for (const child of node.children) {
        flattenFileNode(child, out);
      }
      return out;
    }
    // Empty directory: trailing slash keeps Pierre treating it as a folder.
    if (node.path) out.push(`${node.path}/`);
  }
  return out;
}

export function RichFileTree({
  root,
  paths,
  selectedPath,
  onSelect,
  search = true,
  initialExpansion = "open",
  gitStatus,
  renderContextMenu,
  header,
  themeOverrides,
  className,
  style,
  height,
}: RichFileTreeProps) {
  if (root && paths) {
    throw new Error("RichFileTree: pass `root` or `paths`, not both");
  }

  const flatPaths = useMemo<string[]>(() => {
    if (paths) return Array.from(paths);
    if (root) return flattenFileNode(root);
    return [];
  }, [paths, root]);

  const { model } = usePierreFileTree({
    paths: flatPaths,
    search,
    initialExpansion,
    onSelectionChange: (selected) => {
      const next = selected[0]
      if (next && next !== selectedPath) onSelect?.(next)
    },
  });

  // Push git status whenever it changes. The model's setter is the only
  // way to update post-construction; useEffect keeps it in sync.
  useEffect(() => {
    if (!gitStatus) return;
    model.setGitStatus(gitStatus);
  }, [model, gitStatus]);

  // Reset paths when the input changes after first render. resetPaths
  // re-uses the model and preserves expansion / selection where it can.
  useEffect(() => {
    model.resetPaths(flatPaths);
  }, [model, flatPaths]);

  // Drive selection from props (controlled). Skip when already selected
  // to avoid an emit loop with onSelectionChange.
  useEffect(() => {
    if (!selectedPath) return;
    const current = model.getSelectedPaths();
    if (current.length === 1 && current[0] === selectedPath) return;
    // The public API exposes selection via `select` semantics through the
    // controller — fall back to direct setter when present, no-op otherwise.
    const m = model as unknown as { setSelectedPaths?: (paths: readonly string[]) => void };
    m.setSelectedPaths?.([selectedPath]);
  }, [model, selectedPath]);

  const theme = { ...DEFAULT_THEME, ...themeOverrides };
  const themeStyle = useMemo<CSSProperties>(
    () => ({
      ["--trees-selected-bg-override" as string]: theme.selectedBg,
      ["--trees-selected-fg-override" as string]: theme.selectedFg,
      ["--trees-fg-override" as string]: theme.fg,
      ["--trees-hover-bg-override" as string]: theme.hoverBg,
      ["--trees-border-color-override" as string]: theme.border,
      ["--trees-muted-fg-override" as string]: theme.mutedFg,
      height: height ?? "100%",
      ...style,
    }),
    [theme, height, style],
  );

  return (
    <PierreFileTree
      model={model}
      header={header}
      renderContextMenu={renderContextMenu}
      className={className}
      style={themeStyle}
    />
  );
}
