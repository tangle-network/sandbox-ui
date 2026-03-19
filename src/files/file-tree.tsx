/**
 * FileTree — directory browser with file type icons.
 *
 * Renders a hierarchical file system view. Clicking a file
 * triggers onSelect with the full path.
 */

import { useState, type ReactNode } from "react";
import {
  File,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  Folder,
  FolderOpen,
  ChevronRight,
  FileJson,
} from "lucide-react";
import { cn } from "../lib/utils";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
  mimeType?: string;
}

export interface FileTreeProps {
  root: FileNode;
  selectedPath?: string;
  onSelect?: (path: string, node: FileNode) => void;
  className?: string;
  defaultExpanded?: boolean;
  visibility?: FileTreeVisibilityOptions;
}

export interface FileTreeVisibilityOptions {
  hiddenPaths?: string[];
  hiddenPathPrefixes?: string[];
  isVisible?: (node: FileNode) => boolean;
}

function isNodeVisible(node: FileNode, visibility?: FileTreeVisibilityOptions) {
  if (!visibility) return true;

  if (visibility.hiddenPaths?.includes(node.path)) {
    return false;
  }

  if (
    visibility.hiddenPathPrefixes?.some(
      (prefix) => node.path === prefix || node.path.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  return visibility.isVisible ? visibility.isVisible(node) : true;
}

export function filterFileTree(root: FileNode, visibility?: FileTreeVisibilityOptions): FileNode | null {
  if (!isNodeVisible(root, visibility)) {
    return null;
  }

  if (root.type === "file") {
    return root;
  }

  const children = (root.children ?? [])
    .map((child) => filterFileTree(child, visibility))
    .filter((child): child is FileNode => child !== null);

  if (root.children && root.children.length > 0 && children.length === 0) {
    return null;
  }

  return {
    ...root,
    children,
  };
}

const FILE_ICONS: Record<string, typeof File> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  py: FileCode,
  ts: FileCode,
  js: FileCode,
  json: FileJson,
  yaml: FileCode,
  yml: FileCode,
  md: FileText,
  txt: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
};

function getFileIcon(name: string): typeof File {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || File;
}

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "pdf": return "text-red-400";
    case "py": return "text-yellow-400";
    case "ts":
    case "js": return "text-blue-400";
    case "json": return "text-green-400";
    case "yaml":
    case "yml": return "text-purple-400";
    case "csv":
    case "xlsx": return "text-emerald-400";
    case "md": return "text-[var(--text-secondary)]";
    default: return "text-[var(--text-muted)]";
  }
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath?: string;
  onSelect?: (path: string, node: FileNode) => void;
  defaultExpanded: boolean;
}

function TreeNode({ node, depth, selectedPath, onSelect, defaultExpanded }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isSelected = node.path === selectedPath;
  const isDir = node.type === "directory";

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    }
    onSelect?.(node.path, node);
  };

  const Icon = isDir
    ? (expanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const iconColor = isDir ? "text-[var(--brand-cool)]" : getFileColor(node.name);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-[var(--radius-sm)] text-sm transition-colors",
          "hover:bg-[var(--bg-hover)]",
          isSelected && "bg-[var(--brand-cool)]/10 text-[var(--text-primary)]",
          !isSelected && "text-[var(--text-secondary)]",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir && (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-[var(--text-muted)] transition-transform",
              expanded && "rotate-90",
            )}
          />
        )}
        {!isDir && <span className="w-3" />}
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && !isDir && (
          <span className="text-[var(--text-muted)] text-xs ml-auto tabular-nums">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {isDir && expanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                defaultExpanded={defaultExpanded}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function FileTree({
  root,
  selectedPath,
  onSelect,
  className,
  defaultExpanded = true,
  visibility,
}: FileTreeProps) {
  const visibleRoot = filterFileTree(root, visibility);

  if (!visibleRoot) {
    return null;
  }

  return (
    <div className={cn("text-sm font-[var(--font-sans)]", className)}>
      {visibleRoot.children ? (
        visibleRoot.children
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              defaultExpanded={defaultExpanded}
            />
          ))
      ) : (
        <TreeNode
          node={visibleRoot}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          defaultExpanded={defaultExpanded}
        />
      )}
    </div>
  );
}
