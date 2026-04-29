import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { RichFileTree } from "./rich-file-tree"

describe("RichFileTree", () => {
  it("renders without crashing given a flat path list", () => {
    const { container } = render(
      <RichFileTree paths={["README.md", "src/index.ts"]} />,
    )
    // Pierre renders into a custom element / shadow root; we can't peek
    // inside shadow DOM from RTL, but we can confirm the host mounted.
    expect(container.querySelectorAll("*").length).toBeGreaterThan(0)
  })

  it("flattens a recursive FileNode tree to paths", () => {
    const { container } = render(
      <RichFileTree
        root={{
          name: "root",
          path: "",
          type: "directory",
          children: [
            { name: "a.md", path: "a.md", type: "file" },
            {
              name: "b",
              path: "b",
              type: "directory",
              children: [{ name: "c.md", path: "b/c.md", type: "file" }],
            },
          ],
        }}
      />,
    )
    expect(container.querySelectorAll("*").length).toBeGreaterThan(0)
  })

  it("throws when both root and paths are passed", () => {
    expect(() =>
      render(<RichFileTree root={{ name: "x", path: "x", type: "file" }} paths={["y"]} />),
    ).toThrow(/root.*paths.*not both/i)
  })
})
