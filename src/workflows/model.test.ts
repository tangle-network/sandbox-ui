import { describe, expect, it } from "vitest";
import { buildWorkflowGraph } from "./model";

describe("buildWorkflowGraph", () => {
  it("builds a trigger → action spine for a linear workflow", () => {
    const yaml = `
name: pr-review
on:
  provider_event:
    connection: github
    event: pull_request
    actions: [opened]
do:
  - agent.run:
      profile: code-reviewer
      prompt: Review this PR
  - integration.invoke:
      path: slack.messages.send
`;
    const { nodes, edges, error } = buildWorkflowGraph(yaml);
    expect(error).toBeNull();
    expect(nodes.map((n) => n.id)).toEqual(["trigger", "a0", "a1"]);

    const trigger = nodes[0];
    expect(trigger.data.tone).toBe("trigger");
    expect(trigger.data.isRoot).toBe(true);
    expect(trigger.data.provider).toBe("github");
    expect(trigger.data.subtitle).toContain("GitHub");
    expect(trigger.data.subtitle).toContain("pull_request");

    // integration.invoke surfaces its provider (the path's leading segment).
    expect(nodes[2].data.title).toBe("Integration");
    expect(nodes[2].data.provider).toBe("slack");

    // Spine edges connect sequential nodes via the bottom ("out") handle.
    expect(edges).toEqual([
      {
        id: "trigger->a0",
        source: "trigger",
        target: "a0",
        sourceHandle: "out",
      },
      { id: "a0->a1", source: "a0", target: "a1", sourceHandle: "out" },
    ]);
  });

  it("fans out parallel branches as dangling leaves on the spine node", () => {
    const yaml = `
name: fanout
on:
  schedule:
    cron: "0 9 * * *"
    timezone: UTC
do:
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
        - notify:
            url: https://example.com/b
`;
    const { nodes, edges } = buildWorkflowGraph(yaml);
    const structural = nodes.find((n) => n.id === "a0");
    expect(structural?.data.tone).toBe("structural");
    expect(structural?.data.hasBranches).toBe(true);
    expect(structural?.data.badge).toBe("×2");

    // Two branch leaves, each connected via the "branch" (right) handle.
    expect(nodes.map((n) => n.id)).toContain("a0-b0");
    expect(nodes.map((n) => n.id)).toContain("a0-b1");
    const branchEdges = edges.filter((e) => e.sourceHandle === "branch");
    expect(branchEdges).toHaveLength(2);
    expect(branchEdges.every((e) => e.source === "a0")).toBe(true);
  });

  it("renders a foreach as a structural node with its template leaf", () => {
    const yaml = `
name: each
on:
  schedule:
    cron: "0 9 * * *"
    timezone: UTC
do:
  - foreach:
      items: "\${trigger.payload.repos}"
      do:
        notify:
          url: https://example.com/hook
`;
    const { nodes, edges } = buildWorkflowGraph(yaml);
    const structural = nodes.find((n) => n.id === "a0");
    expect(structural?.data.title).toBe("For each");
    expect(structural?.data.tone).toBe("structural");
    expect(nodes.some((n) => n.id === "a0-b0")).toBe(true);
    expect(
      edges.some((e) => e.source === "a0" && e.sourceHandle === "branch"),
    ).toBe(true);
  });

  it("does not emit a phantom child for a foreach missing its `do` template", () => {
    const yaml = `
name: bad-each
on:
  schedule:
    cron: "0 9 * * *"
    timezone: UTC
do:
  - foreach:
      items: "\${trigger.payload.repos}"
`;
    const { nodes } = buildWorkflowGraph(yaml);
    const structural = nodes.find((n) => n.id === "a0");
    expect(structural?.data.title).toBe("For each");
    // No `do` → no branch leaf, no dangling branch handle.
    expect(structural?.data.hasBranches).toBe(false);
    expect(nodes.some((n) => n.id === "a0-b0")).toBe(false);
  });

  it("returns an error (never throws) for invalid YAML", () => {
    const { nodes, error } = buildWorkflowGraph("name: [unterminated");
    expect(nodes).toEqual([]);
    expect(error).toBe("Invalid YAML");
  });

  it("returns an error for an empty definition", () => {
    expect(buildWorkflowGraph("").error).toBe("No definition");
    expect(buildWorkflowGraph("description: just text").error).toBe(
      "Empty workflow",
    );
  });
});
