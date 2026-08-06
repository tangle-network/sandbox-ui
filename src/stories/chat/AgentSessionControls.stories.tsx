import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AgentSessionControls } from "../../chat/agent-session-controls";
import type { HarnessType } from "../../dashboard/harness-picker";
import type { ModelInfo } from "../../dashboard/model-picker";
import type { ReasoningLevel } from "../../chat/reasoning-level-picker";

/**
 * LEGACY. The composer control every sandbox-backed product renders (tax, gtm,
 * legal all import `AgentSessionControls` from `@tangle-network/sandbox-ui/chat`).
 * Deprecated in favor of `AgentSessionControls` from
 * `@tangle-network/agent-app/web-react`; these stories remain only to document
 * the frozen legacy design until removal at the next major. They exist so the
 * harness menu and the model menu can be screenshotted side by side — they are
 * one family and must read as one family.
 */
const meta: Meta<typeof AgentSessionControls> = {
  title: "Legacy/Chat/AgentSessionControls",
  component: AgentSessionControls,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "DEPRECATED legacy control strip. Use `AgentSessionControls` from `@tangle-network/agent-app/web-react` — the canonical model/effort/harness pickers live in agent-app. This implementation is frozen and will be removed at sandbox-ui's next major. See UI-DIRECTION.md › UI Chrome Ownership.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[560px] w-[720px] items-end rounded-xl bg-muted p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentSessionControls>;

const models: ModelInfo[] = [
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    _provider: "openai",
    pricing: { prompt: "0.0000025", completion: "0.000015" },
    context_length: 400_000,
    architecture: { modality: "text" },
    featured: true,
  },
  {
    id: "claude-opus-5",
    name: "Claude Opus 5",
    _provider: "anthropic",
    pricing: { prompt: "0.000005", completion: "0.000025" },
    context_length: 1_000_000,
    architecture: { modality: "text" },
    featured: true,
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    _provider: "google",
    pricing: { prompt: "0.00000125", completion: "0.00001" },
    context_length: 2_000_000,
    architecture: { modality: "text" },
  },
  {
    id: "kimi-k2",
    name: "Kimi K2",
    _provider: "moonshot",
    pricing: { prompt: "0.0000006", completion: "0.0000025" },
    context_length: 256_000,
    architecture: { modality: "text" },
  },
];

const profiles = [
  { id: "assistant", name: "Assistant", builtin: true },
  { id: "reviewer", name: "Reviewer" },
];

function Controls(props: { layout?: "inline" | "gear" | "combined" }) {
  const [profile, setProfile] = useState("assistant");
  const [harness, setHarness] = useState<HarnessType>("opencode");
  const [model, setModel] = useState("openai/gpt-5.4");
  const [effort, setEffort] = useState<ReasoningLevel>("medium");
  return (
    <AgentSessionControls
      layout={props.layout ?? "inline"}
      profile={{ value: profile, onChange: setProfile, profiles }}
      harness={{ value: harness, onChange: setHarness }}
      model={{ value: model, onChange: setModel, models }}
      reasoning={{ value: effort, onChange: setEffort }}
    />
  );
}

/** Harness / model / effort laid out in a row — the shape used for screenshots. */
export const Inline: Story = { name: "Inline", render: () => <Controls /> };

/** The collapsed trigger tax and gtm both ship in the composer. */
export const Combined: Story = {
  name: "Combined",
  render: () => <Controls layout="combined" />,
};
