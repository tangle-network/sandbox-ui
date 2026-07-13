import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { WorkflowGraphLazy, type WfNodeState } from "../../workflows";

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
  a1: done({ costUsd: undefined, durationMs: 380, outputPreview: '{"status":200}' }),
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

export const CompactRun: Story = {
  name: "Parallel — mid-run (compact density)",
  render: () => (
    <GraphPanel>
      <WorkflowGraphLazy
        yaml={PARALLEL_SYNTHESIS}
        variant="full"
        defaultCompact
        className="h-full w-full"
        nodeState={PARALLEL_RUNNING}
        onNodeClick={() => {}}
      />
    </GraphPanel>
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
