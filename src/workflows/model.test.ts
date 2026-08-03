import { describe, expect, it } from "vitest";
import {
  actionNodeId,
  branchNodeId,
  buildWorkflowGraph,
  COMPACT_NODE_SIZE,
  COMPACT_NODE_SIZE_RUN,
  COMPACT_TILE,
  ACTION_OUTPUT_ROWS,
  AGENT_BODY_ROWS,
  OUTPUT_PREVIEW_CHARS,
  STRUCTURAL_OUTPUT_ROWS,
  TRIGGER_NODE_ID,
  triggerNodeId,
  triggerNodeIndex,
  type WfEdgeSpec,
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

  it("keeps a human-authored slug that merely BEGINS with the minted prefix", () => {
    // A minted id is `ap_` + exactly 16 base64url chars. Matching `ap_` + "8 or
    // more" would also swallow a name a person wrote, replacing it with "AI Agent".
    const title = (profile: string) =>
      buildWorkflowGraph(`
do:
  - agent.run:
      profile: ${profile}
      prompt: Review it.
`).nodes.find((n) => n.id === "a0")?.data.title;

    expect(title("ap_code_review")).toBe("Ap code review");
    expect(title("ap_analytics_bot")).toBe("Ap analytics bot");
    // …while the real thing is still recognised.
    expect(title("ap_NROQux-n7dC7Ll30")).toBe("AI Agent");
  });

  it("recognises a minted id by its EXACT length, one character either side", () => {
    // `ap_` + 12 random bytes as base64url is exactly 16 characters. The boundary is
    // where an off-by-one would hide: one short and a real minted id gets humanised
    // into noise; one long and a name a person wrote gets replaced by "AI Agent".
    const title = (profile: string) =>
      buildWorkflowGraph(`
do:
  - agent.run:
      profile: ${profile}
      prompt: Review it.
`).nodes.find((n) => n.id === "a0")?.data.title;

    const minted = "ap_NROQux-n7dC7Ll30";
    expect(minted.length - "ap_".length).toBe(16);
    expect(title(minted)).toBe("AI Agent");

    // 15 and 17 are not the shape the platform mints, so they are somebody's name.
    expect(title(minted.slice(0, -1))).not.toBe("AI Agent");
    expect(title(`${minted}X`)).not.toBe("AI Agent");
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

  it("reserves each kind's own bands, not one worst case for every node", () => {
    // Guards the fixed-layout invariant — a node's box must equal the sum of the
    // bands its card actually renders, so a card can never exceed (and clip
    // within) the box, and no node reserves a band its kind never draws.
    const yaml = `on:
  schedule:
    cron: "0 0 * * *"
do:
  - agent.run:
      model: gpt-4o
      prompt: summarize
  - notify:
      url: https://example.com/hook
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
        - notify:
            url: https://example.com/b
  - decision:
      title: Ship it?
      prompt: Approve to promote, or hold for a manual check.
      options: [Approve, Hold]
`;
    const byId = (g: ReturnType<typeof buildWorkflowGraph>) =>
      Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const R = byId(buildWorkflowGraph(yaml, { reserveRunState: true }));

    // The schedule trigger only fires: chrome(20) + header(34) + its description
    // (the cron expression, 40). No output, no footer — in a run graph either.
    expect(R.trigger.height).toBe(20 + 34 + 40);

    // An AGENT is answer-first: chrome(20) + the slim identity strip(22) + the
    // answer body(mt-2 8 + 5 x 15.125 = 84) + footer(28). No description band —
    // the prompt is authoring detail a run's reader did not come for — and no
    // metrics line.
    expect(R.a0.height).toBe(20 + 22 + 84 + 28);

    // Every OTHER action: chrome(20) + header(34) + a 3-row well(90) +
    // footer(28). The well is the body plus its caption, padding, border and the
    // `mt-2` above it.
    expect(R.a1.height).toBe(20 + 34 + 90 + 28);

    // CONTROL FLOW routes the run and does no work: chrome(20) + header(34) +
    // a one-line failure slot(22) + footer(28). It books no cost and emits no
    // output, so it reserves for neither.
    expect(R.a2.height).toBe(20 + 34 + 22 + 28);

    // A DECISION shares control flow's tone but keeps its QUESTION, which is
    // what the reader has to act on: chrome(20) + its STACKED header(45) +
    // description(40) + footer(28). Keying the split off tone rather than kind
    // is what would drop it, so this is the assertion that catches that.
    expect(R.a3.height).toBe(20 + 45 + 40 + 28);
    expect(R.a3.height).toBeGreaterThan(R.a2.height);

    // The point of the whole exercise: a node that can say nothing reserves less
    // than one that can say a lot. Before this, every one of them was identical.
    expect(R.a2.height).toBeLessThan(R.a0.height);
  });

  it("reserves enough height for every line each kind's card clamps to", () => {
    // The drift this pairing exists to prevent: raise a row count without its
    // reservation and the card clamps to a line the box has no room to draw, so
    // the last line is silently clipped. A story renders the case, but a story
    // only catches it if someone looks — this fails the build.
    //
    // Asserted on the ARITHMETIC, not on rendered pixels: jsdom performs no
    // layout, so `offsetHeight`/`scrollHeight` are 0 there and a height
    // assertion against the DOM would pass no matter how wrong the reservation
    // got. These per-line figures are the ones measured in the browser.
    //
    // The JSON branch sets the bound for a WELL: its rows are 14.4375px with a
    // 2px `space-y-0.5` between them, which totals higher than prose's solid
    // 15.125px lines from three rows up.
    const WELL_CHROME = 39.5; // mt-2(8) + border(2) + py-1.5(12) + caption+mb-1(17.5)
    const JSON_ROW = 14.4375;
    const JSON_ROW_GAP = 2;
    const wellNeeds = (rows: number) =>
      WELL_CHROME + rows * JSON_ROW + (rows - 1) * JSON_ROW_GAP;

    const yaml = `
on:
  schedule:
    cron: "0 9 * * 1-5"
do:
  - agent.run:
      model: zai/glm-5
      prompt: Generate a fresh motivational quote for the team.
  - notify:
      url: https://example.com/hook
`;
    const nodes = buildWorkflowGraph(yaml, { reserveRunState: true }).nodes;
    const heightOf = (id: string) => nodes.find((n) => n.id === id)?.height ?? 0;

    // Recover each reservation from the built node rather than exporting it: the
    // height is the sum of the bands, and every other band is pinned above.
    //
    // The AGENT body is prose in the foreground token (15.125px solid lines, the
    // size NodeOutputBody sets), not a well — no caption, no frame.
    const agentBody = heightOf(actionNodeId(0)) - (20 + 22 + 28);
    expect(agentBody).toBeGreaterThanOrEqual(8 + AGENT_BODY_ROWS * 15.125);

    const actionWell = heightOf(actionNodeId(1)) - (20 + 34 + 28);
    expect(actionWell).toBeGreaterThanOrEqual(wellNeeds(ACTION_OUTPUT_ROWS));
  });

  it("caps the rows a card clamps to at what the host's preview can fill", () => {
    // The ceiling nothing here can design around: the host sends at most
    // OUTPUT_PREVIEW_CHARS characters and a NODE_W-wide card holds roughly 45 a
    // line, so a card that clamps past that draws BLANK lines — the same defect
    // as clamping below its reservation, from the other side. Raising a row
    // count therefore means raising the host's cap first, in the other repo.
    const CHARS_PER_LINE = 45;
    const fillable = Math.floor(OUTPUT_PREVIEW_CHARS / CHARS_PER_LINE);
    expect(AGENT_BODY_ROWS).toBeLessThanOrEqual(fillable);
    expect(ACTION_OUTPUT_ROWS).toBeLessThanOrEqual(fillable);
    expect(STRUCTURAL_OUTPUT_ROWS).toBeLessThanOrEqual(fillable);
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
    // The (asymmetric) branch stack is centered on that spine line — asserted on
    // the stack's EXTENT (top of the first leaf to the bottom of the last),
    // which is what `layoutLayers` centers when it starts the cursor at
    // `-span / 2`. The mean of the leaf centers is a different quantity once the
    // leaves differ in height: it sits (h0 - h1) / 4 away from the extent's
    // midpoint, so it only agreed with this while every card was the same size.
    const leaves = [byId["a0-b0"], byId["a0-b1"]];
    const stackTop = Math.min(...leaves.map((n) => n.position.y));
    const stackBottom = Math.max(...leaves.map((n) => n.position.y + n.height));
    expect((stackTop + stackBottom) / 2).toBeCloseTo(centerY(byId.a0), 0);
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

describe("node id helpers", () => {
  it("produce exactly the ids the builder emits", () => {
    // THE contract test. Hosts re-derive these ids constantly — a run overlay is
    // keyed by them, a declared topology names its endpoints with them — and they
    // are bare strings, so nothing type-checks a drift between a helper and the
    // builder. Asserting the helpers against a REAL build (never against string
    // literals) is what makes a rename fail HERE, in the package that owns the
    // format, instead of silently in a consumer whose graph loses its edges.
    const yaml = `
on:
  schedule:
    cron: "0 9 * * 1-5"
do:
  - agent.run:
      prompt: First
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
        - notify:
            url: https://example.com/b
`;
    const { nodes, edges } = buildWorkflowGraph(yaml);
    expect(nodes.map((n) => n.id)).toEqual([
      TRIGGER_NODE_ID,
      actionNodeId(0),
      actionNodeId(1),
      branchNodeId(1, 0),
      branchNodeId(1, 1),
    ]);
    // Edge endpoints speak the same ids, so a host can match an edge to the
    // nodes it joins without parsing either.
    expect(edges.map((e) => `${e.source}->${e.target}`)).toContain(
      `${TRIGGER_NODE_ID}->${actionNodeId(0)}`,
    );
    expect(edges.map((e) => `${e.source}->${e.target}`)).toContain(
      `${actionNodeId(1)}->${branchNodeId(1, 0)}`,
    );
  });

  it("round-trips a trigger index and refuses anything that is not one", () => {
    expect(triggerNodeId(0)).toBe(TRIGGER_NODE_ID);
    expect(triggerNodeIndex(triggerNodeId(0))).toBe(0);
    expect(triggerNodeIndex(triggerNodeId(3))).toBe(3);
    expect(triggerNodeIndex(actionNodeId(0))).toBeNull();
    expect(triggerNodeIndex(branchNodeId(0, 1))).toBeNull();
    // A near-miss must read as "not a trigger", never as index NaN — a host
    // branching on `!== null` would otherwise take the trigger path for it.
    expect(triggerNodeIndex("trigger:x")).toBeNull();
    expect(triggerNodeIndex("triggerish")).toBeNull();
  });
});

describe("buildWorkflowGraph — list-form triggers", () => {
  const LIST_YAML = `
on:
  - provider_event:
      connection: github
      event: pull_request
  - schedule:
      cron: "0 9 * * 1-5"
do:
  - agent.run:
      prompt: Handle it
`;

  it("draws one node per subscription, and every one starts the body", () => {
    // `on:` as a list is OR semantics — ANY entry starts the same body. Modelled
    // as a single node it rendered as one unlabelled "Trigger", hiding both the
    // number of ways the workflow can start and what each of them is.
    const { nodes, edges, error } = buildWorkflowGraph(LIST_YAML);
    expect(error).toBeNull();
    expect(nodes.map((n) => n.id)).toEqual([
      TRIGGER_NODE_ID,
      triggerNodeId(1),
      actionNodeId(0),
    ]);
    expect(nodes[0].data.title).toBe("GitHub");
    expect(nodes[0].data.subtitle).toBe("On pull request");
    expect(nodes[1].data.title).toBe("Schedule");
    // Both triggers reach the body.
    expect(edges.map((e) => e.id)).toEqual([
      `${TRIGGER_NODE_ID}->${actionNodeId(0)}`,
      `${triggerNodeId(1)}->${actionNodeId(0)}`,
    ]);
  });

  it("names a webhook trigger rather than falling to the generic Trigger", () => {
    // `webhook` is one of exactly three trigger kinds and its config is empty by
    // schema, so the node's name is all it has to say how the workflow starts.
    const [node] = buildWorkflowGraph("on:\n  webhook: {}\ndo:\n  - notify:\n      url: https://e.co\n").nodes;
    expect(node.data.title).toBe("Webhook");
    expect(node.data.kind).toBe("webhook");
    expect(node.data.subtitle).toBe("On an inbound POST");
  });

  it("stacks the trigger nodes in one layer rather than down the spine", () => {
    // Alternative subscriptions are siblings, not sequential steps: they share
    // rank 0 (same x in LR) and separate along the cross axis.
    const { nodes } = buildWorkflowGraph(LIST_YAML);
    const [first, second] = nodes;
    expect(second.position.x).toBe(first.position.x);
    expect(second.position.y).not.toBe(first.position.y);
  });

  it("leaves a single-trigger graph byte-identical", () => {
    // Entry 0 keeps the plain `trigger` id, so the overwhelmingly common shape
    // is unchanged — including for a host that persisted the old id.
    const single = `
on:
  schedule:
    cron: "0 9 * * 1-5"
do:
  - agent.run:
      prompt: Handle it
`;
    const listOfOne = `
on:
  - schedule:
      cron: "0 9 * * 1-5"
do:
  - agent.run:
      prompt: Handle it
`;
    expect(buildWorkflowGraph(listOfOne)).toEqual(buildWorkflowGraph(single));
  });

  it("treats an empty trigger list as no trigger at all", () => {
    // `on: []` subscribes to nothing. It must not produce a zero-node layout,
    // whose min/max over an empty set yields NaN positions.
    expect(buildWorkflowGraph("on: []").error).toBe("Empty workflow");
    const { nodes } = buildWorkflowGraph("on: []\ndo:\n  - notify:\n      url: https://e.co\n");
    expect(nodes.map((n) => n.id)).toEqual([actionNodeId(0)]);
    expect(nodes[0].data.isRoot).toBe(true);
    expect(Number.isFinite(nodes[0].position.x)).toBe(true);
  });
});

describe("buildWorkflowGraph — declared topology", () => {
  const FOUR = `
on:
  webhook: {}
do:
  - agent.run:
      prompt: Fan out
  - agent.run:
      prompt: Left
  - agent.run:
      prompt: Right
  - agent.run:
      prompt: Join
`;
  const diamond: WfEdgeSpec[] = [
    { from: actionNodeId(0), to: actionNodeId(1) },
    { from: actionNodeId(0), to: actionNodeId(2) },
    { from: actionNodeId(1), to: actionNodeId(3) },
    { from: actionNodeId(2), to: actionNodeId(3) },
  ];

  it("replaces the inferred spine with the declared edges", () => {
    const { edges, error } = buildWorkflowGraph(FOUR, { edges: diamond });
    expect(error).toBeNull();
    // The positional chain a1→a2→a3 is gone; what remains is what was declared,
    // plus the trigger's edge to the one node nothing points at.
    expect(edges.map((e) => e.id).sort()).toEqual(
      [
        "a0->a1",
        "a0->a2",
        "a1->a3",
        "a2->a3",
        `${TRIGGER_NODE_ID}->a0`,
      ].sort(),
    );
    expect(edges.every((e) => e.kind === "spine")).toBe(true);
  });

  it("lays a diamond out as a diamond rather than a chain", () => {
    // This is the half a positional builder cannot do even with the right edges:
    // both arms must share a layer and their join must sit past BOTH of them,
    // otherwise the declared edges are drawn over a chain's positions.
    const byId = new Map(
      buildWorkflowGraph(FOUR, { edges: diamond }).nodes.map((n) => [
        n.id,
        n.position,
      ]),
    );
    const x = (id: string) => byId.get(id)?.x ?? Number.NaN;
    expect(x("a1")).toBe(x("a2"));
    expect(x("a1")).toBeGreaterThan(x("a0"));
    expect(x("a3")).toBeGreaterThan(x("a1"));
    // The arms separate on the cross axis instead of overlapping.
    expect(byId.get("a1")?.y).not.toBe(byId.get("a2")?.y);

    // Contrast: the same YAML with no declared topology is a straight chain, so
    // no two action nodes ever share a layer.
    const chain = buildWorkflowGraph(FOUR).nodes.map((n) => n.position.x);
    expect(new Set(chain).size).toBe(chain.length);
  });

  it("marks the edge that closes a cycle, and only that edge", () => {
    const { edges } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(1), to: actionNodeId(2) },
        // Back to a1: the loop's return path.
        { from: actionNodeId(2), to: actionNodeId(1) },
      ],
    });
    const back = edges.filter((e) => e.backEdge === true).map((e) => e.id);
    expect(back).toEqual(["a2->a1"]);
    // Every forward edge omits the flag entirely rather than carrying `false`,
    // so a host can test truthiness.
    for (const e of edges.filter((e) => e.id !== "a2->a1")) {
      expect(e.backEdge).toBeUndefined();
    }
  });

  it("still ranks every node of a cyclic graph", () => {
    // Layering is defined on a DAG; the back edge is excluded so the sweep
    // drains. A node left unranked would silently pile up at the origin.
    const { nodes } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(1), to: actionNodeId(2) },
        { from: actionNodeId(2), to: actionNodeId(1) },
        { from: actionNodeId(2), to: actionNodeId(3) },
      ],
    });
    const xs = nodes.map((n) => n.position.x);
    expect(xs.every((v) => Number.isFinite(v))).toBe(true);
    const byId = new Map(nodes.map((n) => [n.id, n.position.x]));
    expect(byId.get("a2")).toBeGreaterThan(byId.get("a1") as number);
    expect(byId.get("a3")).toBeGreaterThan(byId.get("a2") as number);
  });

  it("carries a guard summary verbatim onto its edge", () => {
    const { edges } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1), whenLabel: "status == failed" },
        { from: actionNodeId(0), to: actionNodeId(2) },
      ],
    });
    const guarded = edges.find((e) => e.id === "a0->a1");
    expect(guarded?.whenLabel).toBe("status == failed");
    // An unguarded edge omits the field rather than carrying an empty string.
    expect(edges.find((e) => e.id === "a0->a2")?.whenLabel).toBeUndefined();
  });

  it("attaches every trigger to every root, and nothing else", () => {
    const twoTriggers = FOUR.replace(
      "on:\n  webhook: {}",
      "on:\n  - webhook: {}\n  - schedule:\n      cron: \"0 9 * * *\"",
    );
    const { edges } = buildWorkflowGraph(twoTriggers, {
      // a0 and a2 are roots (nothing points at them); a1 and a3 are not.
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(2), to: actionNodeId(3) },
      ],
    });
    const fromTriggers = edges
      .filter((e) => triggerNodeIndex(e.source) !== null)
      .map((e) => e.id)
      .sort();
    expect(fromTriggers).toEqual(
      [
        `${TRIGGER_NODE_ID}->a0`,
        `${TRIGGER_NODE_ID}->a2`,
        `${triggerNodeId(1)}->a0`,
        `${triggerNodeId(1)}->a2`,
      ].sort(),
    );
  });

  it("keeps fan-out edges and drops the positional join", () => {
    // A branch leaf is this module's own node — no declared spec addresses it —
    // so its fork edge survives. The leaf reconverging on "the next list entry"
    // is a positional artifact, and the declared topology now says what follows.
    const yaml = `
on:
  webhook: {}
do:
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
        - notify:
            url: https://example.com/b
  - agent.run:
      prompt: After
`;
    const { edges } = buildWorkflowGraph(yaml, {
      edges: [{ from: actionNodeId(0), to: actionNodeId(1) }],
    });
    expect(edges.filter((e) => e.kind === "fork").map((e) => e.id)).toEqual([
      `${actionNodeId(0)}->${branchNodeId(0, 0)}`,
      `${actionNodeId(0)}->${branchNodeId(0, 1)}`,
    ]);
    expect(edges.some((e) => e.kind === "join")).toBe(false);
    // The leaves are NOT roots, so the trigger does not adopt them.
    expect(
      edges.filter((e) => triggerNodeIndex(e.source) !== null).map((e) => e.id),
    ).toEqual([`${TRIGGER_NODE_ID}->${actionNodeId(0)}`]);
  });

  it("recomputes isRoot from what actually points at a node", () => {
    // Without a trigger the FIRST list entry is the positional root — but a
    // declared topology can make any node the entry, and the handle has to
    // follow the edges rather than the list order.
    const { nodes } = buildWorkflowGraph(
      `
do:
  - agent.run:
      prompt: Second
  - agent.run:
      prompt: First
`,
      { edges: [{ from: actionNodeId(1), to: actionNodeId(0) }] },
    );
    const byId = new Map(nodes.map((n) => [n.id, n.data.isRoot]));
    expect(byId.get(actionNodeId(1))).toBe(true);
    expect(byId.get(actionNodeId(0))).toBe(false);
  });

  it("errors loudly when an edge names a step that does not exist", () => {
    // Never a quiet fall back to the positional spine: the two disagreeing means
    // the topology and the definition came from different places, and drawing
    // edges the run will not take is worse than refusing to draw.
    const { nodes, edges, error } = buildWorkflowGraph(FOUR, {
      edges: [{ from: actionNodeId(0), to: actionNodeId(9) }],
    });
    expect(error).toContain("a9");
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it("draws one line for a pair declared twice", () => {
    const { edges } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(0), to: actionNodeId(1) },
      ],
    });
    expect(edges.filter((e) => e.id === "a0->a1")).toHaveLength(1);
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
  });

  it("survives a self-referencing edge", () => {
    // The compiler rejects a step that needs itself, so this only ever arrives
    // as corrupt data — and a visualiser that hangs or NaNs on corrupt data is
    // worse than one that draws it. The loop is simply its own back edge.
    const { nodes, edges, error } = buildWorkflowGraph(FOUR, {
      edges: [{ from: actionNodeId(0), to: actionNodeId(0) }],
    });
    expect(error).toBeNull();
    expect(edges.find((e) => e.id === "a0->a0")?.backEdge).toBe(true);
    expect(nodes.every((n) => Number.isFinite(n.position.x))).toBe(true);
  });

  it("ranks disjoint chains that never meet", () => {
    // Two independent components: nothing links them, so neither can be reached
    // from the other's entry. Both must still be laid out.
    const { nodes, error } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(2), to: actionNodeId(3) },
      ],
    });
    expect(error).toBeNull();
    expect(nodes.every((n) => Number.isFinite(n.position.x))).toBe(true);
  });

  it("treats an empty declared topology as every step being a root", () => {
    // `edges: []` is a DECLARED topology that happens to have no edges — not the
    // same as omitting it (which infers the positional spine). Every step is
    // then independent, so the trigger starts all of them.
    const { edges } = buildWorkflowGraph(FOUR, { edges: [] });
    expect(edges.map((e) => e.id).sort()).toEqual(
      ["trigger->a0", "trigger->a1", "trigger->a2", "trigger->a3"].sort(),
    );
  });

  it("lays out a cycle that has no entry point at all", () => {
    // No node in the cycle has in-degree 0, so there is nowhere to start a walk
    // from and no trigger edge is synthesized into it.
    //
    // Asserting DISTINCT layers, not merely finite ones: the failure this
    // guards is every node collapsing to rank 0 and stacking on top of each
    // other, and finite-but-identical coordinates would sail through a
    // finiteness check. Removing all DFS back edges always leaves a DAG, and a
    // finite DAG always has a source, so the sweep drains — this pins that.
    const { nodes, error } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(1), to: actionNodeId(2) },
        { from: actionNodeId(2), to: actionNodeId(0) },
      ],
    });
    expect(error).toBeNull();
    expect(nodes).toHaveLength(5);
    expect(nodes.every((n) => Number.isFinite(n.position.x))).toBe(true);
    const cycleX = ["a0", "a1", "a2"].map(
      (id) => nodes.find((n) => n.id === id)?.position.x,
    );
    expect(new Set(cycleX).size).toBe(3);
  });

  it("ranks a cycle whose entry node also carries an outside edge", () => {
    // a1 has TWO incoming edges — one from the entry, one closing the loop — so
    // breaking the cycle still leaves it with in-degree 1. The sweep must reach
    // it from a0 rather than stalling.
    const { nodes } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(1), to: actionNodeId(2) },
        { from: actionNodeId(2), to: actionNodeId(1) },
      ],
    });
    const x = (id: string) => nodes.find((n) => n.id === id)?.position.x ?? Number.NaN;
    expect(x("a1")).toBeGreaterThan(x("a0"));
    expect(x("a2")).toBeGreaterThan(x("a1"));
  });

  it("lays out two disjoint cycles independently", () => {
    // Two components, neither reachable from the other; each must drain on its
    // own rather than one stalling the sweep for both.
    const { nodes, error } = buildWorkflowGraph(FOUR, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1) },
        { from: actionNodeId(1), to: actionNodeId(0) },
        { from: actionNodeId(2), to: actionNodeId(3) },
        { from: actionNodeId(3), to: actionNodeId(2) },
      ],
    });
    expect(error).toBeNull();
    const x = (id: string) => nodes.find((n) => n.id === id)?.position.x ?? Number.NaN;
    expect(x("a0")).not.toBe(x("a1"));
    expect(x("a2")).not.toBe(x("a3"));
  });
});

describe("buildWorkflowGraph — graph-era action kinds", () => {
  it("names script.run, sandbox.snapshot and trace.analyze as themselves", () => {
    // Before these were modelled they fell to the generic branch and read as
    // "Script run" / "Sandbox snapshot" / "Trace analyze" with no subtitle —
    // the humanized identifier, not a description of the step.
    const yaml = `
do:
  - script.run:
      source: "export default async () => ({ ok: true });"
      connections: [github, slack]
  - sandbox.snapshot:
      sandbox: \${steps.build.sandboxId}
  - trace.analyze:
      trace: \${steps.review.traceRef.stepsPath}
      kinds: [failure-mode, knowledge-gap]
`;
    const [script, snapshot, trace] = buildWorkflowGraph(yaml).nodes;

    expect(script.data.title).toBe("Script");
    expect(script.data.kind).toBe("script.run");
    expect(script.data.subtitle).toBe("TypeScript · 2 connections");
    expect(script.data.description).toContain("export default");

    expect(snapshot.data.title).toBe("Snapshot");
    expect(snapshot.data.subtitle).toBe("${steps.build.sandboxId}");

    expect(trace.data.title).toBe("Trace analysis");
    expect(trace.data.subtitle).toBe("failure mode, knowledge gap");
    expect(trace.data.description).toContain("traceRef");
    // The model is incidental to a trace analysis (unlike agent.run, where it IS
    // the identity), so it stays in the config and the node keeps its own glyph.
    expect(trace.data.model).toBeUndefined();
  });

  it("falls back gracefully when the graph-era configs are empty", () => {
    const yaml = `
do:
  - script.run: {}
  - sandbox.snapshot: {}
  - trace.analyze: {}
`;
    const [script, snapshot, trace] = buildWorkflowGraph(yaml).nodes;
    expect(script.data.subtitle).toBe("TypeScript");
    expect(snapshot.data.subtitle).toBe("Capture a sandbox");
    expect(trace.data.subtitle).toBe("Default analysts");
  });
});

describe("buildWorkflowGraph — the edge-label lane", () => {
  const LABELLED = `
on:
  webhook: {}
do:
  - notify:
      url: https://example.com/a
  - notify:
      url: https://example.com/b
`;
  const guard = [
    { from: actionNodeId(0), to: actionNodeId(1), whenLabel: "status == ok" },
  ];
  /** Distance between the two action layers, along the flow axis. */
  const pitch = (graph: ReturnType<typeof buildWorkflowGraph>) => {
    const a0 = graph.nodes.find((n) => n.id === "a0");
    const a1 = graph.nodes.find((n) => n.id === "a1");
    return (a1?.position.x ?? 0) - (a0?.position.x ?? 0);
  };

  it("widens the layer pitch only when an edge actually carries a label", () => {
    // The chip sits in the corridor BETWEEN two layers, so the corridor has to
    // hold one. Unlabelled graphs keep their ordinary pitch — the lane is not a
    // blanket change to every graph's spacing.
    const plain = pitch(buildWorkflowGraph(LABELLED));
    const labelled = pitch(buildWorkflowGraph(LABELLED, { edges: guard }));
    expect(labelled).toBeGreaterThan(plain);
  });

  it("applies the same lane in COMPACT, where the chip is the same size", () => {
    // A compact graph pitches its layers at 20px, and the chip does not shrink
    // with the density — so compact is precisely the case that needs the lane
    // most. The jump is large and deliberate: a chip that overlaps the nodes
    // either side is the defect this reserves against, and a lane narrower than
    // the chip would reintroduce it.
    const compactPlain = pitch(buildWorkflowGraph(LABELLED, { compact: true }));
    const compactLabelled = pitch(
      buildWorkflowGraph(LABELLED, { compact: true, edges: guard }),
    );
    expect(compactLabelled).toBeGreaterThan(compactPlain);
    // Wide enough for the chip's own max width (max-w-40 = 160px).
    expect(compactLabelled).toBeGreaterThanOrEqual(160);
  });

  it("reserves the lane for a cycle badge too, not only a guard", () => {
    // A back edge draws a ↺ badge even with no guard on it.
    const cyclePitch = pitch(
      buildWorkflowGraph(LABELLED, {
        edges: [
          { from: actionNodeId(0), to: actionNodeId(1) },
          { from: actionNodeId(1), to: actionNodeId(0) },
        ],
      }),
    );
    expect(cyclePitch).toBeGreaterThan(pitch(buildWorkflowGraph(LABELLED)));
  });
});

describe("buildWorkflowGraph — folding a long pipeline", () => {
  const chain = (steps: number) =>
    `on:\n  github.issues.opened: {}\ndo:\n${Array.from(
      { length: steps },
      (_, i) =>
        `  - agent.run:\n      model: anthropic/claude-sonnet-4-5\n      prompt: Step ${i}.\n`,
    ).join("")}`;

  /** Distinct y positions, i.e. how many rows the fold produced. */
  const rowsOf = (yaml: string, wrap: boolean) => {
    const g = buildWorkflowGraph(yaml, { compact: true, wrap });
    return new Set(g.nodes.map((n) => n.position.y)).size;
  };

  it("leaves a short pipeline as the single line it reads best as", () => {
    // Below the fold trigger a row still frames at a readable size, and one
    // line states the order for free.
    expect(rowsOf(chain(3), true)).toBe(1);
    const g = buildWorkflowGraph(chain(3), { compact: true, wrap: true });
    // Nothing named its own sides, so the direction still answers for all.
    expect(g.nodes.every((n) => n.sourceSide === undefined)).toBe(true);
  });

  it("folds the same graph the same way with and without a run overlay", () => {
    // Reserving run rows makes a compact node 15px taller, which moves every
    // row's aspect. The fold trigger has to clear that whole window, or a
    // graph would re-fold the moment a run started (see WRAP_ASPECT_TRIGGER).
    for (const steps of [3, 4, 7, 10]) {
      const asDefinition = buildWorkflowGraph(chain(steps), {
        compact: true,
        wrap: true,
      });
      const asRun = buildWorkflowGraph(chain(steps), {
        compact: true,
        wrap: true,
        reserveRunState: true,
      });
      expect(
        asDefinition.nodes.map((n) => n.sourceSide ?? "-"),
        `chain(${steps}) folds differently once a run is in play`,
      ).toEqual(asRun.nodes.map((n) => n.sourceSide ?? "-"));
    }
  });

  it("folds a pipeline that would otherwise run off the panel", () => {
    expect(rowsOf(chain(7), false)).toBe(1);
    expect(rowsOf(chain(7), true)).toBe(3);
    expect(rowsOf(chain(14), true)).toBe(4);
  });

  it("mirrors alternate rows so consecutive steps stay adjacent", () => {
    const g = buildWorkflowGraph(chain(7), { compact: true, wrap: true });
    const rows = [...new Set(g.nodes.map((n) => n.position.y))].sort(
      (a, b) => a - b,
    );
    const xsIn = (row: number) =>
      g.nodes.filter((n) => n.position.y === row).map((n) => n.position.x);
    // The graph's own order runs left-to-right on the first row and
    // right-to-left on the next — a boustrophedon, so no edge ever travels
    // back across the canvas.
    const first = xsIn(rows[0]);
    const second = xsIn(rows[1]);
    expect([...first].sort((a, b) => a - b)).toEqual(first);
    expect([...second].sort((a, b) => b - a)).toEqual(second);
    // Every row change is a straight drop: the last cell of a row sits in the
    // same column as the first cell of the next.
    expect(first.at(-1)).toBe(second[0]);
  });

  it("turns the corner out the side, never across a name", () => {
    const g = buildWorkflowGraph(chain(7), { compact: true, wrap: true });
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const rows = [...new Set(g.nodes.map((n) => n.position.y))].sort(
      (a, b) => a - b,
    );
    // Every node leaves the way its row travels and is entered from behind —
    // the corner included. Nothing leaves downward: the name sits under the
    // tile in LR, so a bottom exit would have to start below it, leaving the
    // arrow floating clear of the node it comes from.
    expect(g.nodes.some((n) => n.sourceSide === "bottom")).toBe(false);
    expect(g.nodes.some((n) => n.targetSide === "top")).toBe(false);
    for (const n of g.nodes) {
      const travelsRight = rows.indexOf(n.position.y) % 2 === 0;
      expect(n.sourceSide).toBe(travelsRight ? "right" : "left");
      expect(n.targetSide).toBe(travelsRight ? "left" : "right");
    }
    // A turn is therefore same-side into the node directly below it, which is
    // what the renderer draws as a bracket in the margin beside the column.
    for (const edge of g.edges) {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to || from.position.y === to.position.y) continue;
      expect(from.position.x).toBe(to.position.x);
      expect(from.sourceSide).toBe(to.targetSide);
    }
  });

  it("keeps a fan-out graph in its layered flow", () => {
    // Branches already occupy the cross axis the fold needs, so a graph with
    // any fan-out is left alone however long it is.
    const yaml = `
on:
  github.issues.opened: {}
do:
  - parallel:
      branches:
        - agent.run:
            model: anthropic/claude-sonnet-4-5
            prompt: A.
        - agent.run:
            model: anthropic/claude-sonnet-4-5
            prompt: B.
  - agent.run:
      model: anthropic/claude-sonnet-4-5
      prompt: Merge.
`;
    const g = buildWorkflowGraph(yaml, { compact: true, wrap: true });
    expect(g.nodes.every((n) => n.sourceSide === undefined)).toBe(true);
  });

  it("keeps a declared topology that skips a step in its layered flow", () => {
    // Mirroring only keeps CONSECUTIVE steps adjacent. A shortcut past a step
    // reads as one hop in a straight line, but becomes a stroke across the
    // middle of a grid once the line is folded — so a topology naming one is
    // left alone however long it is.
    const yaml = chain(7);
    const ids = buildWorkflowGraph(yaml, { compact: true }).nodes.map((n) => n.id);
    const spine = ids.slice(0, -1).map((from, i) => ({ from, to: ids[i + 1] }));

    // The same chain, declared rather than inferred, still folds…
    const declared = buildWorkflowGraph(yaml, {
      compact: true,
      wrap: true,
      edges: spine,
    });
    expect(new Set(declared.nodes.map((n) => n.position.y)).size).toBeGreaterThan(1);

    // …until one edge jumps a layer.
    const withSkip = buildWorkflowGraph(yaml, {
      compact: true,
      wrap: true,
      edges: [...spine, { from: ids[1], to: ids[4] }],
    });
    expect(withSkip.error).toBeNull();
    expect(new Set(withSkip.nodes.map((n) => n.position.y)).size).toBe(1);
    expect(withSkip.nodes.every((n) => n.sourceSide === undefined)).toBe(true);
  });

  it("folds only left-to-right graphs", () => {
    const g = buildWorkflowGraph(chain(10), {
      compact: true,
      wrap: true,
      direction: "TB",
    });
    expect(g.nodes.every((n) => n.sourceSide === undefined)).toBe(true);
  });
});
