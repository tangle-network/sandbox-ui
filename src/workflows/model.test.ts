import { describe, expect, it } from "vitest";
import {
  buildWorkflowGraph,
  COMPACT_NODE_SIZE,
  COMPACT_NODE_SIZE_RUN,
  COMPACT_TILE,
} from "./model";

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

    // The trigger IS its provider — the node is named and branded for it, and the
    // event it wakes on reads as a phrase rather than a raw event id.
    const trigger = nodes[0];
    expect(trigger.data.tone).toBe("trigger");
    expect(trigger.data.isRoot).toBe(true);
    expect(trigger.data.provider).toBe("github");
    expect(trigger.data.title).toBe("GitHub");
    expect(trigger.data.subtitle).toBe("On pull request");
    expect(trigger.data.description).toBe("opened");

    // integration.invoke is likewise named for its provider (the path's leading
    // segment), with the operation as its subtitle.
    expect(nodes[2].data.title).toBe("Slack");
    expect(nodes[2].data.provider).toBe("slack");
    expect(nodes[2].data.subtitle).toBe("send: messages");

    // Spine edges connect sequential nodes (trigger → action → action).
    expect(edges).toEqual([
      { id: "trigger->a0", source: "trigger", target: "a0", kind: "spine" },
      { id: "a0->a1", source: "a0", target: "a1", kind: "spine" },
    ]);
  });

  it("marks the first action as root when there is no trigger", () => {
    // Without an `on:` trigger the first action is the spine root, so it shows no
    // inbound handle (nothing points at it).
    const yaml = `
do:
  - agent.run:
      prompt: Do the thing.
  - notify:
      url: https://example.com
`;
    const { nodes } = buildWorkflowGraph(yaml);
    expect(nodes.find((n) => n.id === "a0")?.data.isRoot).toBe(true);
    expect(nodes.find((n) => n.id === "a1")?.data.isRoot).toBe(false);
  });

  it("names an agent.run for its profile and its model, with the prompt as the description", () => {
    // Title = who the agent is, subtitle = what it runs on, description = the
    // prompt. The model slug drops its vendor prefix (the card's width is scarce)
    // but the full value stays on `model` + in the config.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - agent.run:
      profile: pr-reviewer
      model: anthropic/claude-sonnet-5
      prompt: Summarize the overnight alerts.
`;
    const agent = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(agent?.data.title).toBe("PR reviewer");
    expect(agent?.data.subtitle).toBe("claude-sonnet-5");
    expect(agent?.data.description).toBe("Summarize the overnight alerts.");
    expect(agent?.data.model).toBe("anthropic/claude-sonnet-5");
  });

  it("does not mangle a minted catalog id into a name", () => {
    // The platform mints a stored profile's id as `ap_` + random bytes. Humanising
    // it produces noise ("Ap nro qux n7d c7 ll30") that names nothing, and the
    // catalog that could resolve it lives in the host, not here — so the node stays
    // the generic agent and the host titles it if it can.
    const yaml = `
do:
  - agent.run:
      profile: ap_NROQux-n7dC7Ll30
      model: anthropic/claude-sonnet-5
      prompt: Review it.
`;
    const agent = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(agent?.data.title).toBe("AI Agent");
    // The readable-slug case is untouched.
    expect(
      buildWorkflowGraph(`
do:
  - agent.run:
      profile: pr-reviewer
      prompt: Review it.
`).nodes.find((n) => n.id === "a0")?.data.title,
    ).toBe("PR reviewer");
  });

  it("falls back to a generic agent name when the profile is inline (unnamed)", () => {
    const yaml = `
do:
  - agent.run:
      profile:
        systemPrompt: You are a reviewer.
      prompt: Review it.
`;
    const agent = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(agent?.data.title).toBe("AI Agent");
    expect(agent?.data.subtitle).toBe("Agent");
  });

  it("reads an `if`-guarded action as the action it guards, never as `if`", () => {
    // A `do` entry may carry control-flow siblings (`if`/`retry`/`onError`)
    // alongside its action key, and YAML preserves the author's key order — so a
    // guard written first is the entry's FIRST key. Picking the kind by position
    // rendered a node titled "if" that showed none of the agent it was guarding.
    const yaml = `
do:
  - if:
      equals: ["\${trigger.payload.action}", "opened"]
    agent.run:
      profile: pr-reviewer
      prompt: Review the diff.
    retry:
      attempts: 2
`;
    const node = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(node?.data.kind).toBe("agent.run");
    expect(node?.data.title).toBe("PR reviewer");
    expect(node?.data.description).toBe("Review the diff.");
    // The config is the ACTION's config — not the guard's condition.
    expect(node?.data.config?.prompt).toBe("Review the diff.");
    expect(node?.data.config?.equals).toBeUndefined();
  });

  it("carries the control-flow envelope in the config, not just the action's own fields", () => {
    // A step that may be skipped by a guard, and that retries twice, is not the
    // same step as one that does neither. Selecting the action by kind must not
    // throw its envelope away — the detail view is the one place that promises
    // every field.
    const yaml = `
do:
  - if:
      equals: ["\${trigger.payload.action}", "opened"]
    agent.run:
      profile: pr-reviewer
      prompt: Review the diff.
    retry:
      attempts: 2
    onError: continue
`;
    const node = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(node?.data.config?.prompt).toBe("Review the diff.");
    expect(node?.data.config?.if).toEqual({
      equals: ["\${trigger.payload.action}", "opened"],
    });
    expect(node?.data.config?.retry).toEqual({ attempts: 2 });
    expect(node?.data.config?.onError).toBe("continue");
  });

  it("reads a guarded action of a kind it does not know yet as that action, not as `if`", () => {
    // The kind is whatever is NOT control flow — by exclusion, never by matching a
    // list of kinds we happen to know today. An allowlist would re-break the moment
    // the API adds a kind, resurrecting the "node titled if" bug for it.
    const yaml = `
do:
  - if:
      equals: ["a", "b"]
    agent.review:
      target: main
`;
    const node = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(node?.data.kind).toBe("agent.review");
    expect(node?.data.title).toBe("Agent review");
    expect(node?.data.config?.target).toBe("main");
  });

  it("lays a compact node's name BESIDE its tile under TB, so no edge crosses a word", () => {
    // In TB an edge leaves the tile's BOTTOM — exactly where an LR node puts its
    // name. The TB box is therefore one tile tall and wider, with the name beside
    // the tile.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify:
      url: https://example.com
`;
    const lr = buildWorkflowGraph(yaml, { compact: true, direction: "LR" });
    const tb = buildWorkflowGraph(yaml, { compact: true, direction: "TB" });
    expect(lr.nodes[0].height).toBeGreaterThan(COMPACT_TILE); // tile + name below
    expect(tb.nodes[0].height).toBe(COMPACT_TILE); // one tile tall
    expect(tb.nodes[0].width).toBeGreaterThan(lr.nodes[0].width); // name beside it
    // Uniform, as ever — every TB tile is the same box, run state or not.
    const tbRun = buildWorkflowGraph(yaml, {
      compact: true,
      direction: "TB",
      reserveRunState: true,
    });
    expect(new Set(tbRun.nodes.map((n) => n.height)).size).toBe(1);
    expect(tbRun.nodes[0].height).toBe(COMPACT_TILE);
  });

  it("names a decision node with the title its author wrote", () => {
    const yaml = `
do:
  - decision:
      title: Approve the release?
      options: [approve, reject]
      prompt: Ship v2.4 to production?
`;
    const node = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(node?.data.kind).toBe("decision");
    expect(node?.data.title).toBe("Approve the release?");
    expect(node?.data.subtitle).toBe("approve / reject");
    expect(node?.data.description).toBe("Ship v2.4 to production?");
    expect(node?.data.tone).toBe("structural");
  });

  it("humanizes an action kind it does not model yet", () => {
    // A new kind must still read as words — never as its raw identifier.
    const yaml = `
do:
  - agent.review:
      target: main
`;
    const node = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0");
    expect(node?.data.title).toBe("Agent review");
    expect(node?.data.kind).toBe("agent.review");
  });

  it("says a schedule in English, keeping the expression as the detail", () => {
    const yaml = `
on:
  schedule:
    cron: "0 9 * * 1-5"
    timezone: America/New_York
do:
  - notify:
      url: https://example.com/hook
`;
    const trigger = buildWorkflowGraph(yaml).nodes[0];
    expect(trigger.data.title).toBe("Schedule");
    expect(trigger.data.subtitle).toBe("Weekdays at 09:00");
    expect(trigger.data.description).toBe("0 9 * * 1-5 · America/New_York");
  });

  it("collapses every node to the fixed icon-tile size at compact density", () => {
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - agent.run:
      model: glm-5
      prompt: A long prompt that would make an expanded card tall.
  - notify:
      url: https://example.com
`;
    const expanded = buildWorkflowGraph(yaml, { reserveRunState: true });
    const compact = buildWorkflowGraph(yaml, {
      reserveRunState: true,
      compact: true,
    });
    // Expanded nodes vary by content; compact nodes are all the one fixed size.
    expect(new Set(compact.nodes.map((n) => n.height)).size).toBe(1);
    expect(
      compact.nodes.every((n) => n.height === COMPACT_NODE_SIZE_RUN.height),
    ).toBe(true);
    expect(
      compact.nodes.every((n) => n.width === COMPACT_NODE_SIZE_RUN.width),
    ).toBe(true);
    // The compact tile is shorter than the tall expanded agent card.
    const expandedAgent = expanded.nodes.find((n) => n.id === "a0");
    expect(expandedAgent?.height).toBeGreaterThan(COMPACT_NODE_SIZE_RUN.height);
  });

  it("reserves the run metrics line on a compact node up front, so a live run never reflows it", () => {
    // The layout is computed ONCE, before any run state merges in — a compact node
    // that later shows its duration/cost must already have the room for it.
    const yaml = `
do:
  - notify:
      url: https://example.com
`;
    const still = buildWorkflowGraph(yaml, { compact: true }).nodes[0];
    const running = buildWorkflowGraph(yaml, {
      compact: true,
      reserveRunState: true,
    }).nodes[0];
    expect(still.height).toBe(COMPACT_NODE_SIZE.height);
    expect(running.height).toBe(COMPACT_NODE_SIZE_RUN.height);
    expect(running.height).toBeGreaterThan(still.height);
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
    expect(structural?.data.badge).toBe("×2");

    // Two branch leaves, each connected from the fan-out node by a fork edge.
    expect(nodes.map((n) => n.id)).toContain("a0-b0");
    expect(nodes.map((n) => n.id)).toContain("a0-b1");
    const forkEdges = edges.filter((e) => e.kind === "fork");
    expect(forkEdges).toHaveLength(2);
    expect(forkEdges.every((e) => e.source === "a0")).toBe(true);
    expect(forkEdges.map((e) => e.target).sort()).toEqual(["a0-b0", "a0-b1"]);
    // No spine node follows the fan-out here, so nothing reconverges.
    expect(edges.some((e) => e.kind === "join")).toBe(false);
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
      edges.some(
        (e) => e.source === "a0" && e.target === "a0-b0" && e.kind === "fork",
      ),
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
    // No `do` → no branch leaf emitted.
    expect(nodes.some((n) => n.id === "a0-b0")).toBe(false);
  });

  it("reserves taller nodes for the run view and lays the spine out left-to-right", () => {
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
    const byId = (g: ReturnType<typeof buildWorkflowGraph>) =>
      Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const R = byId(buildWorkflowGraph(yaml, { reserveRunState: true }));
    const C = byId(buildWorkflowGraph(yaml));

    // The run view reserves the rows live state adds (meta chips + a two-line
    // output preview), so an action node is TALLER than in the compact layout —
    // the reservation is baked into the node's dimensions, not a positional gap.
    expect(R.a0.height).toBeGreaterThan(C.a0.height);
    // Default LR: the spine advances along x, and each node clears the previous
    // one's box — width is authoritative, so nodes can never overlap.
    expect(R.trigger.position.x).toBeLessThan(R.a0.position.x);
    expect(R.a0.position.x).toBeLessThan(R.a1.position.x);
    expect(R.a1.position.x).toBeGreaterThanOrEqual(
      R.a0.position.x + R.a0.width,
    );
    // Spine nodes share one straight centerline (equal vertical centers).
    const centerY = (n: (typeof R)[string]) => n.position.y + n.height / 2;
    expect(centerY(R.a0)).toBeCloseTo(centerY(R.a1), 1);
    expect(centerY(R.trigger)).toBeCloseTo(centerY(R.a0), 1);
  });

  it("reserves the run rows by the documented arithmetic: footer for an action, none for a trigger", () => {
    // Guards the fixed-layout invariant — the node box must equal the sum of its
    // reserved rows, so a rendered card can never exceed (and clip within) it.
    const yaml = `on:
  schedule:
    cron: "0 0 * * *"
do:
  - agent.run:
      model: gpt-4o
      prompt: summarize
`;
    const byId = (g: ReturnType<typeof buildWorkflowGraph>) =>
      Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const R = byId(buildWorkflowGraph(yaml, { reserveRunState: true }));
    // The schedule trigger only fires: chrome(20) + header(34) + its description
    // (the cron expression, 40). No metrics, no output, no footer.
    expect(R.trigger.height).toBe(20 + 34 + 40);
    // A run-state agent adds the metrics line(27), the output block(72), and the
    // bottom status footer(28) on top of chrome + header + description(prompt).
    expect(R.a0.height).toBe(20 + 34 + 40 + 27 + 72 + 28);
  });

  it("routes a fan-out through fork+join edges and reconverges on the next layer", () => {
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
    const { nodes, edges } = buildWorkflowGraph(yaml, { reserveRunState: true });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // Fork: the parallel node feeds each of its three leaves.
    const forks = edges.filter((e) => e.kind === "fork");
    expect(forks.every((e) => e.source === "a0")).toBe(true);
    expect(forks.map((e) => e.target).sort()).toEqual([
      "a0-b0",
      "a0-b1",
      "a0-b2",
    ]);
    // Join: every leaf reconverges onto the next spine node — the fan-out no
    // longer dead-ends, and the parallel node does NOT link straight to a1.
    const joins = edges.filter((e) => e.kind === "join");
    expect(joins.map((e) => e.source).sort()).toEqual([
      "a0-b0",
      "a0-b1",
      "a0-b2",
    ]);
    expect(joins.every((e) => e.target === "a1")).toBe(true);
    expect(edges.some((e) => e.source === "a0" && e.target === "a1")).toBe(
      false,
    );

    // Layers advance along x: parallel < its branches < the synthesis node.
    expect(byId.a0.position.x).toBeLessThan(byId["a0-b0"].position.x);
    expect(byId["a0-b0"].position.x).toBeLessThan(byId.a1.position.x);
    // The three leaves share one layer (equal x) and stack without overlapping.
    expect(byId["a0-b1"].position.x).toBe(byId["a0-b0"].position.x);
    expect(byId["a0-b2"].position.x).toBe(byId["a0-b0"].position.x);
    expect(byId["a0-b1"].position.y).toBeGreaterThanOrEqual(
      byId["a0-b0"].position.y + byId["a0-b0"].height,
    );
  });

  it("centers an asymmetric branch stack on the spine and keeps positions non-negative", () => {
    // Branches of unequal height (an agent with a long prompt vs a bare notify).
    const yaml = `
on:
  schedule:
    cron: "0 0 * * *"
do:
  - parallel:
      branches:
        - agent.run:
            model: glm-5
            prompt: A fairly long prompt that makes this card taller than a notify.
        - notify:
            url: https://example.com
  - notify:
      url: https://example.com/done
`;
    const { nodes } = buildWorkflowGraph(yaml, { reserveRunState: true });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const centerY = (n: (typeof byId)[string]) => n.position.y + n.height / 2;
    // The spine stays level: the fan-out node and the reconverging node share a
    // centerline even though the two branches have different heights.
    expect(centerY(byId.a0)).toBeCloseTo(centerY(byId.a1), 0);
    // The (asymmetric) branch stack is centered on that spine line.
    const leaves = [byId["a0-b0"], byId["a0-b1"]];
    const meanLeafCenter =
      leaves.reduce((s, n) => s + centerY(n), 0) / leaves.length;
    expect(meanLeafCenter).toBeCloseTo(centerY(byId.a0), 0);
    // The positive-quadrant shift leaves every node at a non-negative position.
    expect(nodes.every((n) => n.position.x >= 0 && n.position.y >= 0)).toBe(true);
  });

  it("emits a fork and a join edge even for a single-branch fan-out", () => {
    const yaml = `
on:
  schedule:
    cron: "0 0 * * *"
do:
  - parallel:
      branches:
        - notify:
            url: https://example.com
  - notify:
      url: https://example.com/done
`;
    const { edges } = buildWorkflowGraph(yaml);
    // The lone branch still forks out and joins back — not a straight spine edge.
    expect(edges.filter((e) => e.kind === "fork")).toEqual([
      { id: "a0->a0-b0", source: "a0", target: "a0-b0", kind: "fork" },
    ]);
    expect(edges.filter((e) => e.kind === "join")).toEqual([
      { id: "a0-b0->a1", source: "a0-b0", target: "a1", kind: "join" },
    ]);
    // The fan-out node itself does not link straight to the next spine node.
    expect(edges.some((e) => e.source === "a0" && e.target === "a1")).toBe(false);
  });

  it("attaches the raw, untruncated config to action and trigger nodes", () => {
    // A prompt far longer than the card's description clamp — the full-detail
    // `config` must carry it verbatim, never truncated.
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
    // The CARD's copy of the prompt is bounded (it clamps to two lines and feeds a
    // tooltip); `config` is the distinct full-fidelity surface the detail view
    // reads — so the whole prompt is never lost, just never in the card's DOM.
    expect(agent?.data.description?.length).toBeLessThan(longPrompt.length);
    expect(agent?.data.config?.prompt).toBe(longPrompt);
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

  it("deep-copies config so a consumer cannot mutate the parsed definition", () => {
    // Two actions built from the SAME YAML anchor must each own an independent
    // config — mutating one (even a nested field) never leaks into the other or
    // back into internal parse state.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify: &shared
      url: https://example.com
      headers:
        x: "1"
  - notify: *shared
`;
    const { nodes } = buildWorkflowGraph(yaml);
    const a0 = nodes.find((n) => n.id === "a0")?.data.config as
      | Record<string, unknown>
      | undefined;
    const a1 = nodes.find((n) => n.id === "a1")?.data.config;
    expect(a0).toEqual(a1);
    (a0?.headers as Record<string, unknown>).x = "MUTATED";
    expect((a1?.headers as Record<string, unknown> | undefined)?.x).toBe("1");
  });

  it("collapses recursive YAML anchors so config stays JSON-serializable", () => {
    // A recursive anchor makes the parsed config self-referential; the public
    // config must break the cycle so consumers can JSON.stringify / render it.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify: &c
      url: https://example.com
      self: *c
`;
    const { nodes } = buildWorkflowGraph(yaml);
    const cfg = nodes.find((n) => n.id === "a0")?.data.config as
      | Record<string, unknown>
      | undefined;
    expect(cfg?.url).toBe("https://example.com");
    expect(cfg?.self).toBe("[Circular]");
    // The whole graph must serialize without throwing on the cycle.
    expect(() => JSON.stringify(nodes)).not.toThrow();
  });

  it("keeps non-cyclic shared (DAG) config refs intact, not collapsed to [Circular]", () => {
    // `headers` and `defaults` alias the SAME map — a diamond, not a cycle. Both
    // must materialize fully; only true ancestor cycles collapse.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify:
      headers: &h
        a: "1"
      defaults: *h
`;
    const { nodes } = buildWorkflowGraph(yaml);
    const cfg = nodes.find((n) => n.id === "a0")?.data.config;
    expect((cfg?.headers as Record<string, unknown>)?.a).toBe("1");
    expect((cfg?.defaults as Record<string, unknown>)?.a).toBe("1");
  });

  it("bounds deeply nested config instead of overflowing the stack", () => {
    // buildWorkflowGraph never throws; a pathologically deep config must collapse
    // past the depth budget to a marker, not blow the call stack.
    const deep = `${"{a: ".repeat(150)}1${"}".repeat(150)}`;
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify:
      nested: ${deep}
`;
    let result: ReturnType<typeof buildWorkflowGraph> | undefined;
    expect(() => {
      result = buildWorkflowGraph(yaml);
    }).not.toThrow();
    const cfg = result?.nodes.find((n) => n.id === "a0")?.data.config;
    expect(cfg).toBeDefined();
    expect(() => JSON.stringify(result?.nodes)).not.toThrow();
    expect(JSON.stringify(cfg)).toContain("[Max depth exceeded]");
  });

  it("normalizes non-finite numbers (.nan/.inf) to null so config stays JSON-valued", () => {
    const yaml = `
on:
  schedule:
    cron: "0 9 * * *"
do:
  - notify:
      a: .nan
      b: .inf
      c: -.inf
      d: 42
`;
    const cfg = buildWorkflowGraph(yaml).nodes.find((n) => n.id === "a0")?.data
      .config;
    expect(cfg?.a).toBeNull();
    expect(cfg?.b).toBeNull();
    expect(cfg?.c).toBeNull();
    expect(cfg?.d).toBe(42);
  });

  it("exposes raw config for an unknown/custom trigger kind too", () => {
    // The full-detail contract applies to every trigger kind, not just
    // provider_event/schedule — the fallback branch must carry config as well.
    const yaml = `
on:
  custom_event:
    channel: "#alerts"
    filter: { level: high }
do:
  - sandbox.spawn: {}
`;
    const trigger = buildWorkflowGraph(yaml).nodes.find(
      (n) => n.id === "trigger",
    );
    expect(trigger?.data.config).toMatchObject({
      channel: "#alerts",
      filter: { level: "high" },
    });
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
