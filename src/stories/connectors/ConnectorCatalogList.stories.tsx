import type { Meta, StoryObj } from "@storybook/react";
import { ConnectorCatalogList } from "../../connectors/catalog-list";
import type { ConnectorCatalogEntry } from "../../connectors/types";

const entries: ConnectorCatalogEntry[] = [
  {
    providerId: "github",
    title: "GitHub",
    category: "dev",
    categoryLabel: "Developer Tools",
    authKind: "oauth",
    authKindLabel: "OAuth",
    actionCount: 42,
    triggerCount: 3,
    connected: true,
  },
  {
    providerId: "slack",
    title: "Slack",
    category: "comms",
    categoryLabel: "Communication",
    authKind: "oauth",
    authKindLabel: "OAuth",
    actionCount: 18,
    triggerCount: 4,
  },
  {
    providerId: "gmail",
    title: "Gmail",
    category: "comms",
    categoryLabel: "Communication",
    authKind: "oauth",
    authKindLabel: "OAuth",
    actionCount: 11,
    triggerCount: 1,
    connected: true,
  },
  {
    providerId: "stripe",
    title: "Stripe",
    category: "finance",
    categoryLabel: "Finance",
    authKind: "api_key",
    authKindLabel: "API Key",
    actionCount: 30,
    triggerCount: 5,
  },
  {
    providerId: "linear",
    title: "Linear",
    category: "dev",
    categoryLabel: "Developer Tools",
    authKind: "api_key",
    authKindLabel: "API Key",
    actionCount: 9,
    triggerCount: 2,
  },
  {
    providerId: "notion",
    title: "Notion",
    category: "productivity",
    categoryLabel: "Productivity",
    authKind: "oauth",
    authKindLabel: "OAuth",
    actionCount: 14,
    triggerCount: 0,
  },
];

// A simple colored initial chip stands in for the host's brand icon.
function DemoIcon({ providerId }: { providerId: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high font-semibold text-foreground text-sm uppercase">
      {providerId.slice(0, 1)}
    </div>
  );
}

const meta: Meta<typeof ConnectorCatalogList> = {
  title: "Connectors/ConnectorCatalogList",
  component: ConnectorCatalogList,
  parameters: { layout: "padded", backgrounds: { default: "dark" } },
  args: {
    entries,
    getConnectorHref: (id) => `#/connectors/${id}`,
    onOpenConnector: (id) => console.log("open connector", id),
    onRequestIntegration: (prefill) =>
      console.log("request integration", prefill),
  },
};

export default meta;
type Story = StoryObj<typeof ConnectorCatalogList>;

export const Default: Story = {
  name: "Default",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorCatalogList {...args} />
    </div>
  ),
};

export const WithHostIcons: Story = {
  name: "With host icons",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorCatalogList {...args} />
    </div>
  ),
  args: {
    renderIcon: (id) => <DemoIcon providerId={id} />,
  },
};

export const Empty: Story = {
  name: "No connectors",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorCatalogList {...args} />
    </div>
  ),
  args: { entries: [] },
};
