import { describe, expect, it } from "vitest"
import * as workflows from "./index"

/**
 * The workflows entry is the one a host renders a graph from, and the node cards it
 * renders resolve a model's brand mark themselves (node-ui.tsx). A host labelling a
 * node OUTSIDE the canvas — a side panel, a run row — needs the same two symbols, and
 * the only other entry that publishes them is `dashboard`, which carries the whole
 * model-picker/widget surface behind it: reaching for them there costs a consumer
 * kilobytes of gzipped JS for a glyph. Keeping them on this entry is therefore a
 * contract, not a convenience, and this asserts it stays one.
 */
describe("@tangle-network/sandbox-ui/workflows entry", () => {
  it("publishes the model brand mark the graph's own node cards use", () => {
    expect(typeof workflows.modelBrandFor).toBe("function")
    expect(typeof workflows.ModelBrandStack).toBe("function")
  })

  it("resolves a brand from a bare model id, as a node card does", () => {
    expect(workflows.modelBrandFor("anthropic/claude-sonnet-4-5")?.lab.key).toBe(
      "anthropic",
    )
    expect(workflows.modelBrandFor("some-internal/model-x")).toBeNull()
  })
})
