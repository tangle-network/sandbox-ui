import type { FileNode } from "@tangle-network/ui/files";

/**
 * Nests flat paths into folders. A path ending in `/` is a directory, so an
 * empty folder survives; leading `./` and `/` are ignored.
 */
export function fileTreeFromPaths(paths: ReadonlyArray<string>): FileNode[] {
  const top: FileNode[] = [];
  const folders = new Map<string, FileNode>();
  const folder = (path: string): FileNode[] => {
    if (!path) return top;
    const existing = folders.get(path);
    if (existing) return (existing.children ??= []);
    const slash = path.lastIndexOf("/");
    const node: FileNode = { name: path.slice(slash + 1), path, type: "directory", children: [] };
    folders.set(path, node);
    folder(slash < 0 ? "" : path.slice(0, slash)).push(node);
    return node.children!;
  };
  for (const raw of paths) {
    const path = raw.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, "");
    if (!path) continue;
    if (raw.endsWith("/")) {
      folder(path);
      continue;
    }
    const slash = path.lastIndexOf("/");
    folder(slash < 0 ? "" : path.slice(0, slash)).push({ name: path.slice(slash + 1), path, type: "file" });
  }
  return top;
}

/**
 * Case-insensitive name filter: a file survives when its name matches; a
 * folder survives whole when its own name matches, otherwise only with the
 * descendants that survive.
 */
export function filterFileNodes(nodes: ReadonlyArray<FileNode>, query: string): FileNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...nodes];
  const out: FileNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(q)) {
      out.push(node);
    } else if (node.type === "directory") {
      const children = filterFileNodes(node.children ?? [], q);
      if (children.length > 0) out.push({ ...node, children });
    }
  }
  return out;
}
