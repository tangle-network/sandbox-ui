import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import {
  actionNodeId,
  WorkflowGraphLazy,
  type WfEdgeSpec,
  type WfNodeState,
} from "../../workflows";

/**
 * Iteration harness for the workflow visualizer. Renders the real
 * `WorkflowGraphLazy` (the production component) over a gallery of workflow
 * shapes — linear, provider-event trigger, parallel fan-out + synthesis,
 * foreach, and a large mixed pipeline — each in its static-definition,
 * mid-run, and terminal states. Use it to tune layout/orientation/edges in
 * isolation before verifying against a real run in the platform app.
 */

// React Flow's `useColorMode` keys off the `.dark` class on <html>, which the
// Storybook theme decorator (data-sandbox-theme) does not set — so sync it here
// off the SB theme global, keeping the graph's chrome (edges, controls,
// background) in the same theme as the brand tokens.
const withColorMode: Decorator = (Story, context) => {
  const isLight = (context.globals.sandboxTheme ?? "dark") === "light";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", !isLight);
  }, [isLight]);
  return <Story />;
};

/** Mimics the run-detail "Graph" panel: a card with a header and a fixed-height
 *  canvas the graph fills. `height` lets a story match the real 28rem panel or a
 *  taller canvas for a dense fixture. */
function GraphPanel({
  children,
  height = "h-[28rem]",
  title = "Graph",
}: {
  children: React.ReactNode;
  height?: string;
  title?: string;
}) {
  return (
    <div className="w-[1000px] max-w-full rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-text">{title}</span>
        <span className="text-text-muted text-xs">Live: latest run</span>
      </div>
      <div className={`${height} w-full overflow-hidden rounded-lg border border-border bg-background`}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixtures: representative workflow YAML for each structural shape.
// ---------------------------------------------------------------------------

const LINEAR = `on:
  schedule:
    cron: "0 9 * * 1-5"
    timezone: America/New_York
do:
  - agent.run:
      model: zai/glm-5
      prompt: Generate a fresh motivational quote for the team.
  - notify:
      url: https://httpbin.org/post
`;

const PROVIDER_EVENT = `on:
  provider_event:
    connection: github
    event: pull_request
    actions: [opened, synchronize]
    repo: tangle-network/agent-dev-container
do:
  - agent.run:
      model: anthropic/claude-sonnet-5
      profile: pr-reviewer
      prompt: Review the pull request diff and summarize the risks.
      maxRounds: 6
  - integration.invoke:
      path: github.pulls.reviews.create
  - notify:
      url: https://example.com/webhook
`;

const PARALLEL_SYNTHESIS = `on:
  schedule:
    cron: "0 0 * * *"
do:
  - parallel:
      branches:
        - agent.run:
            model: deepseek/deepseek-chat
            prompt: Audit the change for security vulnerabilities.
        - agent.run:
            model: deepseek/deepseek-chat
            prompt: Audit the change for performance regressions.
        - agent.run:
            model: deepseek/deepseek-chat
            prompt: Audit the change for maintainability and style.
  - agent.run:
      model: anthropic/claude-opus-4-8
      prompt: Merge the three specialist reviews into one verdict.
  - notify:
      url: https://httpbin.org/post
`;

const FOREACH = `on:
  provider_event:
    connection: github
    event: issues
    actions: [labeled]
do:
  - foreach:
      items: \${trigger.issues}
      do:
        agent.run:
          model: zai/glm-5
          prompt: Triage the issue and propose a resolution.
  - notify:
      url: https://httpbin.org/post
`;

const MIXED = `on:
  provider_event:
    connection: github
    event: push
    repo: tangle-network/platform
do:
  - sandbox.spawn:
      template: node-20
      size: medium
  - agent.run:
      model: anthropic/claude-sonnet-5
      profile: builder
      prompt: Build the project and run the full test suite.
  - parallel:
      branches:
        - integration.invoke:
            path: github.checks.create
        - notify:
            url: https://httpbin.org/post
  - agent.run:
      model: zai/glm-5
      prompt: Summarize the build result for the team channel.
`;

// Every node kind in one graph: a branded provider trigger, a guarded agent
// (control-flow keys FIRST, the order that used to render a node titled "if"),
// a human-in-the-loop decision, and two provider integrations.
const CONTROL_FLOW = `on:
  provider_event:
    connection: github
    event: pull_request
    actions: [opened, ready_for_review]
    repo: tangle-network/agent-dev-container
do:
  - if:
      equals: ["\${trigger.payload.draft}", false]
    agent.run:
      profile: pr-reviewer
      model: anthropic/claude-sonnet-5
      prompt: Review the pull request diff and summarize the risks.
      maxRounds: 6
    retry:
      attempts: 2
  - decision:
      title: Approve the release?
      options: [approve, request changes]
      prompt: The reviewer flagged two medium-severity findings.
  - integration.invoke:
      path: github.pulls.reviews.create
  - integration.invoke:
      path: slack.postMessage
`;

// ---------------------------------------------------------------------------
// Run-state builders: small helpers to compose a `nodeState` map keyed by node
// id (`trigger`, `a0`, `a0-b1`, …). Absent ⇒ the static definition view.
// ---------------------------------------------------------------------------

const done = (o: Partial<WfNodeState> = {}): WfNodeState => ({
  status: "succeeded",
  durationMs: 3200,
  costUsd: 0.0023,
  ...o,
});
const running = (o: Partial<WfNodeState> = {}): WfNodeState => ({
  status: "running",
  ...o,
});
const failed = (o: Partial<WfNodeState> = {}): WfNodeState => ({
  status: "failed",
  durationMs: 1400,
  ...o,
});
const queued = (): WfNodeState => ({ status: "queued" });
const waiting = (o: Partial<WfNodeState> = {}): WfNodeState => ({
  status: "waiting",
  ...o,
});

// A run parked on a human `decision`: the agent has finished, the decision node
// is blocked on the viewer, and the branch after it hasn't started. This is the
// shape that used to render as an empty box badged "Running".
const HUMAN_DECISION = `
on:
  schedule:
    cron: "0 9 * * 1"
do:
  - agent.run:
      model: anthropic/claude-haiku-4-5
      prompt: Find my most recent merged pull request and summarize it.
  - decision:
      title: Ship the release?
      prompt: 3 PRs merged since the last tag.
      options: [approve, reject]
      onTimeout: default
      default: reject
      timeout: 24h
  - agent.run:
      model: anthropic/claude-haiku-4-5
      prompt: The user chose to \${steps[1].choice}. Act on it.
`;

const DECISION_WAITING: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: done({
    model: "anthropic/claude-haiku-4-5",
    costUsd: 0.0016,
    durationMs: 6100,
    rounds: 1,
    inputTokens: 6,
    outputTokens: 392,
    outputPreview:
      "Perfect! I found your most recent merged pull request. Here are the details: ## Your Most…",
  }),
  a1: waiting(),
  a2: queued(),
};

// Linear, fully succeeded (mirrors the real `workflow-green-run` capture).
const LINEAR_DONE: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: done({
    model: "zai/glm-5",
    costUsd: 0.0023,
    durationMs: 4200,
    inputTokens: 210,
    outputTokens: 48,
    outputPreview:
      '"Today is a new page; write something worth remembering." — Ralph Waldo Emerson',
  }),
  a1: done({
    costUsd: undefined,
    durationMs: 380,
    outputPreview: '{"status":200,"id":4821,"url":"https://httpbin.org/post"}',
  }),
};

// Parallel fan-out mid-run: one branch done, one running, one queued.
const PARALLEL_RUNNING: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: running(),
  "a0-b0": done({
    model: "deepseek/deepseek-chat",
    costUsd: 0.0041,
    durationMs: 5200,
    rounds: 4,
    outputPreview: "2 high-severity findings: unsanitized path join, missing authz check.",
  }),
  "a0-b1": running({
    model: "deepseek/deepseek-chat",
    rounds: 2,
    outputPreview: "Profiling the hot loop…",
  }),
  "a0-b2": queued(),
  a1: queued(),
  a2: queued(),
};

// Mixed pipeline terminal with a failure partway (notify branch fails).
const MIXED_FAILED: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: done({ costUsd: undefined, durationMs: 2600, outputPreview: "sandbox node-20 ready" }),
  a1: done({
    model: "anthropic/claude-sonnet-5",
    costUsd: 0.031,
    durationMs: 48200,
    inputTokens: 8200,
    outputTokens: 1400,
    outputPreview: "Build succeeded. 214 tests passed, 0 failed.",
  }),
  a2: failed(),
  "a2-b0": done({ costUsd: undefined, durationMs: 640, outputPreview: "check created" }),
  "a2-b1": failed({
    error: "notify: refusing to follow a 302 redirect to an unvetted address",
  }),
  a3: queued(),
};

// Control-flow pipeline mid-run: the guarded agent is done, the decision is
// waiting on a human, and the integrations haven't been reached.
const CONTROL_FLOW_RUNNING: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: done({
    model: "anthropic/claude-sonnet-5",
    costUsd: 0.0316,
    durationMs: 48200,
    rounds: 4,
    inputTokens: 8240,
    outputTokens: 1409,
    outputPreview:
      "Perfect! I reviewed the diff.\n\n## Summary\n\n- **Blocking**: none\n- **Medium**: the retry loop never caps its backoff\n- **Nit**: `parseArgs` shadows an import",
  }),
  a1: running(),
  a2: queued(),
  a3: queued(),
};

// The provider-event spine mid-run, used by the TB stories (a fan-out would make
// the direction flip harder to read at a glance).
const PROVIDER_EVENT_RUNNING: Record<string, WfNodeState> = {
  trigger: done({ durationMs: undefined, costUsd: undefined }),
  a0: done({
    model: "anthropic/claude-sonnet-5",
    costUsd: 0.0312,
    durationMs: 41200,
    rounds: 3,
    outputPreview: "Reviewed 14 files. No blocking issues.",
  }),
  a1: running(),
  a2: queued(),
};

const meta: Meta<typeof WorkflowGraphLazy> = {
  title: "Workflows/WorkflowGraph",
  component: WorkflowGraphLazy,
  parameters: { layout: "centered", backgrounds: { disable: true } },
  decorators: [
    withColorMode,
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WorkflowGraphLazy>;

// --- Static definition views (one per shape) -------------------------------

export const Linear: Story = {
  name: "Linear (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy yaml={LINEAR} variant="full" className="h-full w-full" />
    </GraphPanel>
  ),
};

export const ProviderEvent: Story = {
  name: "Provider event (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy yaml={PROVIDER_EVENT} variant="full" className="h-full w-full" />
    </GraphPanel>
  ),
};

export const ParallelSynthesis: Story = {
  name: "Parallel + synthesis (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy yaml={PARALLEL_SYNTHESIS} variant="full" className="h-full w-full" />
    </GraphPanel>
  ),
};

export const Foreach: Story = {
  name: "Foreach (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy yaml={FOREACH} variant="full" className="h-full w-full" />
    </GraphPanel>
  ),
};

export const Mixed: Story = {
  name: "Mixed pipeline (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy yaml={MIXED} variant="full" className="h-full w-full" />
    </GraphPanel>
  ),
};

// --- Run-state views -------------------------------------------------------

export const LinearSucceeded: Story = {
  name: "Linear — succeeded run",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={LINEAR}
        variant="full"
        className="h-full w-full"
        nodeState={LINEAR_DONE}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const DecisionWaiting: Story = {
  name: "Decision — parked on a human",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={HUMAN_DECISION}
        variant="full"
        className="h-full w-full"
        nodeState={DECISION_WAITING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const DecisionDefinition: Story = {
  name: "Decision — definition only",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={HUMAN_DECISION}
        variant="full"
        className="h-full w-full"
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const ParallelRunning: Story = {
  name: "Parallel — mid-run",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={PARALLEL_SYNTHESIS}
        variant="full"
        className="h-full w-full"
        nodeState={PARALLEL_RUNNING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const MixedFailed: Story = {
  name: "Mixed — failed run",
  render: () => (
    <GraphPanel height="h-[32rem]">
      <WorkflowGraphLazy
        yaml={MIXED}
        variant="full"
        className="h-full w-full"
        nodeState={MIXED_FAILED}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const ExpandedRun: Story = {
  name: "Parallel — mid-run (expanded density)",
  render: () => (
    <GraphPanel height="h-[32rem]">
      <WorkflowGraphLazy
        yaml={PARALLEL_SYNTHESIS}
        variant="full"
        defaultCompact={false}
        className="h-full w-full"
        nodeState={PARALLEL_RUNNING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const MixedFailedExpanded: Story = {
  name: "Mixed — failed run (expanded density)",
  render: () => (
    <GraphPanel height="h-[34rem]">
      <WorkflowGraphLazy
        yaml={MIXED}
        variant="full"
        defaultCompact={false}
        className="h-full w-full"
        nodeState={MIXED_FAILED}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const ControlFlow: Story = {
  name: "Control flow — guarded agent + decision (definition)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={CONTROL_FLOW}
        variant="full"
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const ControlFlowRunning: Story = {
  name: "Control flow — mid-run",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={CONTROL_FLOW}
        variant="full"
        className="h-full w-full"
        nodeState={CONTROL_FLOW_RUNNING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const ControlFlowExpanded: Story = {
  name: "Control flow — mid-run (expanded density)",
  render: () => (
    <GraphPanel height="h-[32rem]">
      <WorkflowGraphLazy
        yaml={CONTROL_FLOW}
        variant="full"
        defaultCompact={false}
        className="h-full w-full"
        nodeState={CONTROL_FLOW_RUNNING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
  ),
};

export const TopToBottom: Story = {
  name: "Top-to-bottom direction (compact + expanded)",
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="grid grid-cols-2 gap-6 p-6">
      <GraphPanel title="TB · compact" height="h-[34rem]">
        <WorkflowGraphLazy
          yaml={PROVIDER_EVENT}
          variant="full"
          direction="TB"
          className="h-full w-full"
          nodeState={PROVIDER_EVENT_RUNNING}
          onNodeClick={() => {}}
        />
      </GraphPanel>
      <GraphPanel title="TB · expanded" height="h-[34rem]">
        <WorkflowGraphLazy
          yaml={PROVIDER_EVENT}
          variant="full"
          direction="TB"
          defaultCompact={false}
          className="h-full w-full"
          nodeState={PROVIDER_EVENT_RUNNING}
          onNodeClick={() => {}}
        />
      </GraphPanel>
    </div>
  ),
};

// --- Compact preview variant (assistant proposal card) ---------------------

export const Preview: Story = {
  name: "Preview variant (proposal card)",
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      {[LINEAR, PARALLEL_SYNTHESIS].map((yaml) => (
        <div
          key={yaml}
          className="h-[220px] w-[360px] overflow-hidden rounded-lg border border-border bg-card"
        >
          <WorkflowGraphLazy yaml={yaml} variant="preview" className="h-full w-full" />
        </div>
      ))}
    </div>
  ),
};

// --- At-a-glance gallery (all shapes, static) ------------------------------

export const Gallery: Story = {
  name: "Gallery (all shapes)",
  parameters: { layout: "fullscreen" },
  render: () => {
    const items: [string, string][] = [
      ["Linear", LINEAR],
      ["Provider event", PROVIDER_EVENT],
      ["Parallel + synthesis", PARALLEL_SYNTHESIS],
      ["Foreach", FOREACH],
      ["Mixed pipeline", MIXED],
    ];
    return (
      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-2">
        {items.map(([label, yaml]) => (
          <GraphPanel key={label} title={label} height="h-[24rem]">
            <WorkflowGraphLazy yaml={yaml} variant="full" className="h-full w-full" />
          </GraphPanel>
        ))}
      </div>
    );
  },
};

// --- Declared topology -----------------------------------------------------
// The shapes a positional spine cannot express: a diamond, guarded branches,
// and a guarded cycle. The YAML below is the same `do` list in every one — only
// the declared `edges` differ, which is the point: what connects to what is the
// topology's to say, not the list order's.

const GRAPH_BODY = `on:
  provider_event:
    connection: github
    event: pull_request
    actions: [opened, synchronize]
do:
  - agent.run:
      profile: triage
      prompt: Triage the change and decide what review it needs.
  - agent.run:
      profile: security-reviewer
      prompt: Review the diff for security regressions.
  - script.run:
      source: |
        export default async ({ steps }) => ({ lint: steps.triage.output });
      connections: [github]
  - agent.run:
      profile: synthesizer
      prompt: Merge both reviews into one verdict.
  - integration.invoke:
      path: github.pulls.reviews.create
`;

const DIAMOND_EDGES: WfEdgeSpec[] = [
  { from: actionNodeId(0), to: actionNodeId(1) },
  { from: actionNodeId(0), to: actionNodeId(2) },
  { from: actionNodeId(1), to: actionNodeId(3) },
  { from: actionNodeId(2), to: actionNodeId(3) },
  { from: actionNodeId(3), to: actionNodeId(4) },
];

const GUARDED_EDGES: WfEdgeSpec[] = [
  { from: actionNodeId(0), to: actionNodeId(1), whenLabel: "risk == high" },
  { from: actionNodeId(0), to: actionNodeId(2), whenLabel: "risk != high" },
  { from: actionNodeId(1), to: actionNodeId(3) },
  { from: actionNodeId(2), to: actionNodeId(3) },
  {
    from: actionNodeId(3),
    to: actionNodeId(4),
    whenLabel: "verdict == approved",
  },
];

const CYCLE_EDGES: WfEdgeSpec[] = [
  { from: actionNodeId(0), to: actionNodeId(1) },
  { from: actionNodeId(1), to: actionNodeId(3) },
  // The loop: synthesis sends it back for another review round.
  { from: actionNodeId(3), to: actionNodeId(1), whenLabel: "needs another pass" },
  { from: actionNodeId(3), to: actionNodeId(4), whenLabel: "verdict == approved" },
];

export const DeclaredDiamond: Story = {
  name: "Declared: diamond (definition)",
  render: () => (
    <GraphPanel title="Graph — declared topology">
      <WorkflowGraphLazy
        yaml={GRAPH_BODY}
        edges={DIAMOND_EDGES}
        variant="full"
        defaultCompact={false}
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const DeclaredGuards: Story = {
  name: "Declared: guarded branches",
  render: () => (
    <GraphPanel title="Graph — guarded edges">
      <WorkflowGraphLazy
        yaml={GRAPH_BODY}
        edges={GUARDED_EDGES}
        variant="full"
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const DeclaredCycle: Story = {
  name: "Declared: guarded cycle + visit budget",
  render: () => (
    <GraphPanel title="Graph — cycle">
      <WorkflowGraphLazy
        yaml={GRAPH_BODY}
        edges={CYCLE_EDGES}
        maxNodeVisits={25}
        variant="full"
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const DeclaredCycleRunning: Story = {
  name: "Declared: cycle mid-run",
  render: () => (
    <GraphPanel title="Graph — cycle, second pass">
      <WorkflowGraphLazy
        yaml={GRAPH_BODY}
        edges={CYCLE_EDGES}
        maxNodeVisits={25}
        variant="full"
        nodeState={
          {
            [actionNodeId(0)]: { status: "succeeded", costUsd: 0.004 },
            [actionNodeId(1)]: { status: "running", rounds: 2 },
            [actionNodeId(3)]: { status: "succeeded", costUsd: 0.011 },
          } satisfies Record<string, WfNodeState>
        }
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const DeclaredSelected: Story = {
  name: "Declared: node selected",
  render: () => (
    <GraphPanel title="Graph — selection reflected from the host">
      <WorkflowGraphLazy
        yaml={GRAPH_BODY}
        edges={DIAMOND_EDGES}
        selectedNodeId={actionNodeId(3)}
        variant="full"
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

export const MultiTrigger: Story = {
  name: "List-form trigger (one node per subscription)",
  render: () => (
    <GraphPanel title="Graph — three ways to start">
      <WorkflowGraphLazy
        yaml={`on:
  - provider_event:
      connection: github
      event: pull_request
      actions: [opened]
  - schedule:
      cron: "0 9 * * 1-5"
  - webhook: {}
do:
  - agent.run:
      profile: triage
      prompt: Handle whatever woke us.
  - sandbox.snapshot:
      sandbox: \${steps.triage.sandboxId}
  - trace.analyze:
      trace: \${steps.triage.traceRef.stepsPath}
      kinds: [failure-mode, knowledge-gap]
`}
        variant="full"
        defaultCompact={false}
        className="h-full w-full"
      />
    </GraphPanel>
  ),
};

/**
 * The canvas as an EDITOR. Supplying `onEdgeConnect` is what arms it: handles
 * become visible and draggable, an edge takes focus and answers Delete, and
 * clicking one asks to edit its guard. The gestures are reported as node ids —
 * turning one into a definition edit is the host's job — so this harness just
 * records what it was told, which is exactly the contract a consumer implements.
 */
// Two roots (a0 and a2), so the trigger fans out — which is both a realistic
// shape and the one that makes the synthesized trigger edges visibly distinct
// from the declared ones a host may actually edit.
const EDITABLE_EDGES: WfEdgeSpec[] = [
  { from: actionNodeId(0), to: actionNodeId(1), whenLabel: "risk == high" },
  { from: actionNodeId(1), to: actionNodeId(3) },
  { from: actionNodeId(2), to: actionNodeId(3) },
  {
    from: actionNodeId(3),
    to: actionNodeId(4),
    whenLabel: "verdict == approved",
  },
];

function EditableHarness() {
  // The log is an event stream, so identity is the OCCURRENCE, not the text: the
  // same gesture legitimately repeats (guard the same edge twice, reconnect and
  // delete it again), and keying by the line would then hand React duplicate
  // keys. Keying by array index is no better on a list that prepends and slices.
  const [log, setLog] = useState<{ id: number; line: string }[]>([]);
  const nextId = useRef(0);
  const note = (line: string) => {
    // The id is taken OUTSIDE the updater: a state updater must be pure, and
    // React invokes it twice under StrictMode — incrementing in there would
    // burn two ids per gesture.
    const id = nextId.current++;
    setLog((l) => [{ id, line }, ...l].slice(0, 6));
  };
  return (
    <div className="flex w-[1000px] max-w-full flex-col gap-3">
      <GraphPanel title="Graph — editable" height="h-[26rem]">
        <WorkflowGraphLazy
          yaml={GRAPH_BODY}
          edges={EDITABLE_EDGES}
          variant="full"
          defaultCompact={false}
          className="h-full w-full"
          onEdgeConnect={(source, target) => note(`connect ${source} → ${target}`)}
          onEdgeDelete={(source, target) => note(`delete ${source} → ${target}`)}
          onEdgeClick={(source, target) => note(`guard ${source} → ${target}`)}
          onNodeClick={(nodeId) => note(`select ${nodeId}`)}
        />
      </GraphPanel>
      <div
        data-testid="gesture-log"
        className="rounded-lg border border-border bg-card p-3 font-mono text-text-muted text-xs"
      >
        {log.length === 0
          ? "Drag a handle to connect · click an edge to guard it · select an edge and press Delete"
          : log.map((entry) => <div key={entry.id}>{entry.line}</div>)}
      </div>
    </div>
  );
}

export const DeclaredEditable: Story = {
  name: "Declared: editable canvas",
  render: () => <EditableHarness />,
};
