import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ModelPicker, type ModelInfo } from "../../dashboard/model-picker";

const meta: Meta<typeof ModelPicker> = {
  title: "Dashboard/ModelPicker",
  component: ModelPicker,
  parameters: { layout: "centered", backgrounds: { default: "dark" } },
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
    id: "gpt-5.4",
    name: "GPT-5.4",
    _provider: "openai",
    pricing: { prompt: "0.0000025", completion: "0.000015" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    _provider: "openai",
    pricing: { prompt: "0.00000075", completion: "0.0000045" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "gpt-5.4-pro",
    name: "GPT-5.4 pro",
    _provider: "openai",
    pricing: { prompt: "0.00003", completion: "0.00018" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    _provider: "anthropic",
    pricing: { prompt: "0.000003", completion: "0.000015" },
    context_length: 200_000,
    architecture: { modality: "text" },
  },
  {
    id: "anthropic/claude-opus-4-7",
    name: "Claude Opus 4.7",
    _provider: "anthropic",
    pricing: { prompt: "0.000015", completion: "0.000075" },
    context_length: 200_000,
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
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    _provider: "google",
    pricing: { prompt: "0.00000125", completion: "0.00001" },
    context_length: 2_000_000,
    architecture: { modality: "text" },
  },
];

export const Default: Story = {
  name: "Default (field)",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.4");
    return <ModelPicker value={value} onChange={setValue} models={models} recents={["anthropic/claude-sonnet-4-6"]} />;
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
    const [value, setValue] = useState("openai/gpt-5.4");
    return <ModelPicker variant="pill" value={value} onChange={setValue} models={models} />;
  },
};

export const Loading: Story = {
  name: "Loading",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.4");
    return <ModelPicker value={value} onChange={setValue} models={[]} loading />;
  },
};

export const FilteredToText: Story = {
  name: "Text-only modality",
  render: () => {
    const [value, setValue] = useState("openai/gpt-5.4");
    return <ModelPicker value={value} onChange={setValue} models={models} modalities={["text"]} />;
  },
};
