import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import {
  WorkflowGraphLazy,
  type WfEdgeSpec,
  type WfNodeState,
} from "../../workflows";
import fixtures from "./template-fixtures.json";

/**
 * The platform's real gallery templates, drawn the way the platform draws
 * them: each template's YAML with the topology its compiler produces. These
 * are the shapes the layout has to hold up on, so they are the visual
 * baselines for it — a fixture invented here would only prove the layout on a
 * shape no user sees.
 *
 * `template-fixtures.json` is generated from agent-container's template
 * catalog (the YAML and the compiled spec's edges with their guard
 * summaries); regenerate it when the catalogue's shapes change.
 */

interface TemplateFixture {
  name: string;
  yaml: string;
  maxNodeVisits?: number;
  edges: WfEdgeSpec[];
}

const TEMPLATES = fixtures as Record<string, TemplateFixture>;

const withColorMode: Decorator = (Story, context) => {
  const isLight = (context.globals.sandboxTheme ?? "dark") === "light";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", !isLight);
  }, [isLight]);
  return <Story />;
};

function TemplateCanvas({
  id,
  nodeState,
  height = "h-[34rem]",
  width = "w-[1100px]",
  compact = true,
}: {
  id: string;
  nodeState?: Record<string, WfNodeState>;
  height?: string;
  width?: string;
  compact?: boolean;
}) {
  const t = TEMPLATES[id];
  return (
    <div className={`${width} max-w-full rounded-xl border border-border bg-card p-3`}>
      <div className="mb-2 font-medium text-sm text-text">{t.name}</div>
      <div
        className={`${height} w-full overflow-hidden rounded-lg border border-border bg-background`}
      >
        <WorkflowGraphLazy
          yaml={t.yaml}
          edges={t.edges}
          maxNodeVisits={t.maxNodeVisits}
          variant="full"
          defaultCompact={compact}
          wrap
          className="h-full w-full"
          {...(nodeState ? { nodeState } : {})}
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof WorkflowGraphLazy> = {
  title: "Workflows/Templates",
  component: WorkflowGraphLazy,
  parameters: { layout: "centered", backgrounds: { disable: true } },
  decorators: [
    withColorMode,
    (Story) => (
      <div className="w-full max-w-[calc(100vw-2rem)] p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WorkflowGraphLazy>;

export const SoftwareFactory: Story = {
  render: () => <TemplateCanvas id="software-factory" />,
};

export const SoftwareFactoryExpanded: Story = {
  render: () => <TemplateCanvas id="software-factory" compact={false} />,
};

export const SoftwareFactoryRunning: Story = {
  render: () => (
    <TemplateCanvas
      id="software-factory"
      nodeState={{
        trigger: { status: "succeeded" },
        a0: { status: "succeeded", costUsd: 0.002, durationMs: 2100 },
        a1: { status: "skipped" },
        a2: { status: "skipped" },
        a3: { status: "skipped" },
        a5: { status: "succeeded", costUsd: 0.41, durationMs: 512000 },
        a6: { status: "succeeded", durationMs: 900 },
        a7: { status: "succeeded", durationMs: 300 },
        a8: { status: "succeeded", costUsd: 0.12, durationMs: 188000 },
        a9: { status: "running", rounds: 3 },
        a10: { status: "running", rounds: 2 },
        a11: { status: "running", rounds: 4 },
      }}
    />
  ),
};

export const FanoutReview: Story = {
  render: () => <TemplateCanvas id="fanout-review" />,
};

export const PrReview: Story = {
  render: () => <TemplateCanvas id="pr-review" />,
};

export const EngineeringAudit: Story = {
  render: () => <TemplateCanvas id="engineering-audit" />,
};

export const DesignAudit: Story = {
  render: () => <TemplateCanvas id="design-audit" />,
};

export const FeatureDevRalph: Story = {
  render: () => <TemplateCanvas id="feature-dev-ralph" />,
};

export const SoftwareFactoryPhone: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => (
    <TemplateCanvas id="software-factory" width="w-[358px]" height="h-[36rem]" />
  ),
};
