import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ModelPicker, type ModelInfo } from "../../dashboard/model-picker";

const meta: Meta<typeof ModelPicker> = {
  title: "Legacy/Dashboard/ModelPicker",
  component: ModelPicker,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "DEPRECATED legacy picker. Use `ModelPicker` from `@tangle-network/agent-app/web-react` — the canonical model/effort/harness pickers live in agent-app. This implementation is frozen and will be removed at sandbox-ui's next major. See UI-DIRECTION.md › UI Chrome Ownership.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] p-6 rounded-xl bg-muted">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ModelPicker>;

const models: ModelInfo[] = [
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    _provider: "openai",
    pricing: { prompt: "0.0000025", completion: "0.000015" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "gpt-5.6-sol-mini",
    name: "GPT-5.6 Sol mini",
    _provider: "openai",
    pricing: { prompt: "0.00000075", completion: "0.0000045" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "gpt-5.6-sol-pro",
    name: "GPT-5.6 Sol pro",
    _provider: "openai",
    pricing: { prompt: "0.00003", completion: "0.00018" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "anthropic/claude-fable-5",
    name: "Claude Fable 5",
    _provider: "anthropic",
    pricing: { prompt: "0.000003", completion: "0.000015" },
    context_length: 1_000_000,
    architecture: { modality: "text" },
  },
  {
    id: "anthropic/claude-fable-5",
    name: "Claude Fable 5 via OpenRouter",
    _provider: "openrouter",
    pricing: { prompt: "0.0000035", completion: "0.0000175" },
    context_length: 1_000_000,
    architecture: { modality: "text" },
  },
  {
    id: "kling/v2.1",
    name: "Kling 2.1",
    _provider: "tcloud",
    pricing: { prompt: "0", completion: "0" },
    context_length: 8_000,
    architecture: { modality: "text->video" },
  },
  {
    id: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    _provider: "anthropic",
    pricing: { prompt: "0.000015", completion: "0.000075" },
    context_length: 1_000_000,
    architecture: { modality: "text" },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    _provider: "anthropic",
    pricing: { prompt: "0.000001", completion: "0.000005" },
    context_length: 200_000,
    architecture: { modality: "text" },
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    _provider: "google",
    pricing: { prompt: "0.00000125", completion: "0.00001" },
    context_length: 2_000_000,
    architecture: { modality: "text" },
  },
];

export const Default: Story = {
  name: "Default (field)",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.6-sol");
    return <ModelPicker value={value} onChange={setValue} models={models} recents={["anthropic/claude-fable-5"]} />;
  },
};

export const Popular: Story = {
  name: "With popular section",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.6-sol");
    return (
      <ModelPicker
        value={value}
        onChange={setValue}
        models={models}
        popular={[
          "openai/gpt-5.6-sol",
          "anthropic/claude-fable-5",
          "anthropic/claude-opus-5",
          "openai/gpt-5.6-sol-mini",
          "anthropic/claude-haiku-4.5",
        ]}
      />
    );
  },
};

export const Pill: Story = {
  name: "Pill (chat input)",
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-[420px] p-12 rounded-xl bg-muted">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.6-sol");
    return <ModelPicker variant="pill" value={value} onChange={setValue} models={models} />;
  },
};

export const Loading: Story = {
  name: "Loading",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.6-sol");
    return <ModelPicker value={value} onChange={setValue} models={[]} loading />;
  },
};

export const FilteredToText: Story = {
  name: "Text-only modality",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.6-sol");
    return <ModelPicker value={value} onChange={setValue} models={models} modalities={["text"]} />;
  },
};
