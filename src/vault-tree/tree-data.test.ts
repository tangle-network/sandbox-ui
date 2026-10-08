import { describe, expect, it } from "vitest";
import { fileTreeFromPaths, filterFileNodes } from "./tree-data";

describe("fileTreeFromPaths", () => {
  it("nests paths, keeps empty folders, and ignores leading ./ and /", () => {
    expect(fileTreeFromPaths(["empty/", "./drafts/plan.md", "/drafts/q4/notes.md", "readme.md"])).toEqual([
      { name: "empty", path: "empty", type: "directory", children: [] },
      { name: "drafts", path: "drafts", type: "directory", children: [
        { name: "plan.md", path: "drafts/plan.md", type: "file" },
        { name: "q4", path: "drafts/q4", type: "directory", children: [{ name: "notes.md", path: "drafts/q4/notes.md", type: "file" }] },
      ] },
      { name: "readme.md", path: "readme.md", type: "file" },
    ]);
  });
});

describe("filterFileNodes", () => {
  const tree = fileTreeFromPaths(["campaigns/plan.md", "campaigns/outreach.md", "research/sources.md"]);

  it("keeps matching files with their folders and drops the rest", () => {
    expect(filterFileNodes(tree, "OUTREACH")).toEqual([
      { name: "campaigns", path: "campaigns", type: "directory", children: [{ name: "outreach.md", path: "campaigns/outreach.md", type: "file" }] },
    ]);
  });

  it("keeps a folder whole when its own name matches, and everything for an empty query", () => {
    expect(filterFileNodes(tree, "research")).toEqual([tree[1]]);
    expect(filterFileNodes(tree, "  ")).toEqual(tree);
  });
});
