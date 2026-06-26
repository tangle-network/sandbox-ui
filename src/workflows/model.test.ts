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

  it("reserves spine spacing for a tall running node so live nodes never overlap", () => {
    const yaml = `
on:
  provider_event:
    connection: github
    event: pull_request
do:
  - agent.run:
      profile: code-reviewer
      model: glm-5
      prompt: Review the PR
  - integration.invoke:
      path: github.pulls.reviews.create
`;
    const yOf = (g: ReturnType<typeof buildWorkflowGraph>) =>
      Object.fromEntries(g.nodes.map((n) => [n.id, n.position.y]));
    const reserved = yOf(buildWorkflowGraph(yaml, { reserveRunState: true }));
    const compact = yOf(buildWorkflowGraph(yaml));

    // The run view leaves room for a fully-populated running card (status badge +
    // meta chips + a two-line output preview, ~160px) so a live node can't grow
    // into the one below it — the spine gap clears that height.
    expect(reserved.a1 - reserved.a0).toBeGreaterThanOrEqual(150);
    // …and that's strictly more room than the compact static/preview layout, which
    // reserves nothing (a proposal card never shows run state).
    expect(reserved.a1 - reserved.a0).toBeGreaterThan(compact.a1 - compact.a0);
    // Spine is strictly top-to-bottom in both modes (monotonically increasing y).
    expect(reserved.trigger).toBeLessThan(reserved.a0);
    expect(reserved.a0).toBeLessThan(reserved.a1);
    expect(compact.trigger).toBeLessThan(compact.a0);
    expect(compact.a0).toBeLessThan(compact.a1);
  });

  it("clears a tall structural node's branch stack before the next spine node", () => {
    const yaml = `
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
        - notify:
            url: https://example.com/c
  - agent.run:
      profile: code-reviewer
      prompt: summarize
`;
    const { nodes } = buildWorkflowGraph(yaml, { reserveRunState: true });
    const y = Object.fromEntries(nodes.map((n) => [n.id, n.position.y]));
    // The next spine node sits below the LAST dangling branch leaf, never beside
    // or above it — the spine advance accounts for the whole branch stack.
    expect(y.a1).toBeGreaterThan(y["a0-b2"]);
  });

  it("attaches the raw, untruncated config to action and trigger nodes", () => {
    // A prompt far longer than the compact `detail` clamp (200 chars) — the
    // full-detail `config` must carry it verbatim, never truncated.
    const longPrompt = `Review this PR carefully. ${"x".repeat(500)}`;
    const yaml = `
name: pr-review
on:
  provider_event:
    connection: github
    event: pull_request
    actions: [opened, synchronize]
    repo: tangle-network/agent-dev-container
do:
  - agent.run:
      profile: code-reviewer
      maxRounds: 3
      source:
        repo: "\${trigger.repository.full_name}"
        pr: "\${trigger.pull_request.number}"
      prompt: ${JSON.stringify(longPrompt)}
`;
    const { nodes } = buildWorkflowGraph(yaml);

    // Trigger node carries the full provider_event config.
    const trigger = nodes.find((n) => n.id === "trigger");
    expect(trigger?.data.config).toMatchObject({
      connection: "github",
      event: "pull_request",
      actions: ["opened", "synchronize"],
      repo: "tangle-network/agent-dev-container",
    });

    // agent.run node carries every config field, prompt UNtruncated, and nested
    // objects (source) preserved as objects (not the compact "…" placeholder).
    const agent = nodes.find((n) => n.id === "a0");
    expect(agent?.data.config?.profile).toBe("code-reviewer");
    expect(agent?.data.config?.maxRounds).toBe(3);
    expect(agent?.data.config?.prompt).toBe(longPrompt);
    expect(agent?.data.config?.source).toEqual({
      repo: "${trigger.repository.full_name}",
      pr: "${trigger.pull_request.number}",
    });
    // The compact `detail` still clamps the prompt (so the card stays small),
    // proving `config` is the distinct full-fidelity surface.
    expect((agent?.data.detail?.prompt?.length ?? 0)).toBeLessThan(
      longPrompt.length,
    );
  });

  it("omits config for an action and a trigger that declare none", () => {
    // An empty action config AND an empty trigger config are omitted entirely
    // (never `config: {}`), so both honor the "omitted when no config" contract.
    const yaml = `
on:
  provider_event: {}
do:
  - sandbox.spawn: {}
`;
    const { nodes } = buildWorkflowGraph(yaml);
    expect(nodes.find((n) => n.id === "trigger")?.data.config).toBeUndefined();
    expect(nodes.find((n) => n.id === "a0")?.data.config).toBeUndefined();
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
