import type { Meta, StoryObj } from "@storybook/react";
import { WorkflowGraphLazy } from "../../workflows";

/**
 * Candidates for how a long workflow should occupy its panel.
 *
 * Every canvas below is 742x480 — the workflow detail page's graph panel
 * (`h-[30rem]`, that wide beside the step list). Each row shows the SAME
 * workflow framed two ways, so the question is only ever "which of these do I
 * want to look at".
 */

const chain = (steps: number) =>
  `on:\n  github.issues.opened: {}\ndo:\n${Array.from(
    { length: steps },
    () =>
      `  - agent.run:\n      model: anthropic/claude-sonnet-4-5\n      prompt: Read the diff and decide whether it is safe to merge.\n`,
  ).join("")}`;

function Canvas({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-text-muted text-xs">{caption}</div>
      <div
        style={{ width: 742, height: 480 }}
        className="overflow-hidden rounded-lg border border-border bg-background"
      >
        {children}
      </div>
    </div>
  );
}

function Compare({
  title,
  steps,
  compact = true,
}: {
  title: string;
  steps: number;
  compact?: boolean;
}) {
  const common = {
    yaml: chain(steps),
    variant: "full" as const,
    defaultCompact: compact,
    className: "h-full w-full",
    nodeState: {},
  };
  return (
    <div className="mb-8">
      <div className="mb-2 font-medium text-base text-text">{title}</div>
      <div className="flex flex-wrap gap-6">
        <Canvas caption="one row — today">
          <WorkflowGraphLazy {...common} />
        </Canvas>
        <Canvas caption="folded into rows">
          <WorkflowGraphLazy {...common} wrap />
        </Canvas>
      </div>
    </div>
  );
}

const meta: Meta = { title: "workflows/Framing candidates" };
export default meta;

/** Under the fold threshold: a short pipeline stays the line it reads best as,
 *  so both canvases are identical on purpose. */
export const ShortStaysALine: StoryObj = {
  render: () => <Compare title="3 steps — unchanged (below the fold threshold)" steps={3} />,
};

/** The first length that folds. One row frames at 0.70; folded, at 1.18. */
export const FoldsAtFour: StoryObj = {
  render: () => <Compare title="4 steps — first length that folds (title 8.3px → 14.1px)" steps={4} />,
};

/** The reported bug's shape: one row clips, folded fits whole. */
export const Reported: StoryObj = {
  render: () => <Compare title="7 steps — the reported case (74px clipped → fits, 6.6px → 11.3px)" steps={7} />,
};

/** Where one row stops being a diagram at all. */
export const Long: StoryObj = {
  render: () => <Compare title="10 steps (384px clipped → fits, 6.6px → 10.5px)" steps={10} />,
};

export const VeryLong: StoryObj = {
  render: () => <Compare title="14 steps (798px clipped → fits, 6.6px → 8.4px)" steps={14} />,
};

/** Folding removes the clipping for expanded cards too — but the card text is
 *  still ~7px, so density is a separate problem from framing. */
export const ExpandedCards: StoryObj = {
  render: () => (
    <Compare
      title="6 steps, EXPANDED cards — folding fixes the clipping, not the legibility"
      steps={6}
      compact={false}
    />
  ),
};

/** Every folding length in one page. */
export const Gallery: StoryObj = {
  render: () => (
    <div>
      <Compare title="3 steps — stays a line" steps={3} />
      <Compare title="4 steps" steps={4} />
      <Compare title="7 steps — the reported case" steps={7} />
      <Compare title="10 steps" steps={10} />
      <Compare title="14 steps" steps={14} />
    </div>
  ),
};
