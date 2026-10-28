import { describe, expect, it } from "vitest";
import { buildWorkflowGraph } from "./model";
import { KIND_ICON } from "./node-ui";

/** A definition exercising every action and trigger kind the model names. New
 *  kinds belong here, which is what keeps the coverage test below honest. */
const EVERY_KIND_YAML = `
on:
  - provider_event:
      connection: github
      event: pull_request
  - schedule:
      cron: "0 9 * * *"
      timezone: UTC
  - webhook: {}
do:
  - sandbox.spawn: {}
  - integration.invoke:
      path: github.issues.create
  - notify:
      url: https://example.com
  - agent.run:
      prompt: Review it.
  - decision:
      title: Ship it?
  - script.run:
      source: "export default async () => ({ ok: true });"
  - sandbox.snapshot:
      sandbox: \${steps.spawn.sandboxId}
  - trace.analyze:
      trace: \${steps.run.traceRef.stepsPath}
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
  - foreach:
      items: \${trigger.payload.items}
      do:
        notify:
          url: https://example.com/b
`;

describe("kind glyphs", () => {
  it("gives every kind the model emits an icon — none may fall through", () => {
    // The node mark resolves `KIND_ICON[kind] || Circle`. That fallback is right
    // for a kind from a NEWER api than this library, and wrong for one the model
    // already emits: such a node renders as an anonymous dot that looks
    // deliberate, so nobody notices the glyph was never wired. Deriving the kinds
    // from a real build (rather than listing them here) is what makes this fail
    // when a kind is added to the model and not to the table — the failure the
    // `webhook` trigger actually hit.
    const { nodes, error } = buildWorkflowGraph(EVERY_KIND_YAML);
    expect(error).toBeNull();
    const kinds = [...new Set(nodes.map((n) => n.data.kind))];
    // Guard the guard: if the fixture stops producing kinds, the check below
    // would pass vacuously.
    expect(kinds.length).toBeGreaterThanOrEqual(13);
    expect(kinds.filter((k) => !k || !KIND_ICON[k])).toEqual([]);
  });

  it("maps the graph-era kinds to distinct glyphs, not a shared placeholder", () => {
    // Three steps that do very different things (run code, capture a disk,
    // analyse a trace) must not read as the same node.
    const graphEra = ["script.run", "sandbox.snapshot", "trace.analyze"];
    for (const kind of graphEra) {
      // Defined, not "is a function": a lucide icon is a forwardRef component,
      // which types as an object.
      expect(KIND_ICON[kind]).toBeDefined();
    }
    expect(new Set(graphEra.map((k) => KIND_ICON[k])).size).toBe(
      graphEra.length,
    );
  });
});
