import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { HarnessPicker, type HarnessType } from "../../dashboard/harness-picker";

const meta: Meta<typeof HarnessPicker> = {
  title: "Dashboard/HarnessPicker",
  component: HarnessPicker,
  parameters: { layout: "centered", backgrounds: { default: "dark" } },
  decorators: [
    (Story) => (
      <div className="w-[360px] p-6 rounded-xl bg-muted">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HarnessPicker>;

export const Default: Story = {
  name: "Default",
  render: () => {
    const [value, setValue] = useState<HarnessType>("opencode");
    return <HarnessPicker value={value} onChange={setValue} />;
  },
};

export const RestrictedToFreeTier: Story = {
  name: "Restricted (free tier)",
  render: () => {
    const [value, setValue] = useState<HarnessType>("opencode");
    return (
      <HarnessPicker
        value={value}
        onChange={setValue}
        available={["opencode", "cli-base"]}
      />
    );
  },
};

export const WithOverrides: Story = {
  name: "With option overrides",
  render: () => {
    const [value, setValue] = useState<HarnessType>("claude-code");
    return (
      <HarnessPicker
        value={value}
        onChange={setValue}
        optionsOverride={{
          "claude-code": { description: "Pro plan only — uses your ANTHROPIC key" },
        }}
      />
    );
  },
};
