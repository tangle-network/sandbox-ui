import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { IntegrationsPanel } from "../../integrations/integrations-panel";
import type {
  IntegrationConnection,
  IntegrationProvider,
} from "../../integrations/types";

const meta: Meta<typeof IntegrationsPanel> = {
  title: "Integrations/IntegrationsPanel",
  component: IntegrationsPanel,
  parameters: { layout: "fullscreen", backgrounds: { default: "dark" } },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof IntegrationsPanel>;

const catalog: IntegrationProvider[] = [
  { providerId: "gmail", displayName: "Gmail" },
  { providerId: "google-sheets", displayName: "Google Sheets" },
  { providerId: "google-drive", displayName: "Google Drive" },
  { providerId: "google-calendar", displayName: "Google Calendar" },
  { providerId: "outlook", displayName: "Outlook" },
  { providerId: "slack", displayName: "Slack" },
  { providerId: "discord", displayName: "Discord" },
  { providerId: "notion", displayName: "Notion" },
  { providerId: "airtable", displayName: "Airtable" },
  { providerId: "hubspot", displayName: "HubSpot" },
  { providerId: "salesforce", displayName: "Salesforce" },
  { providerId: "github", displayName: "GitHub" },
  { providerId: "gitlab", displayName: "GitLab" },
  { providerId: "linear", displayName: "Linear" },
  { providerId: "jira", displayName: "Jira" },
  { providerId: "asana", displayName: "Asana" },
  { providerId: "stripe", displayName: "Stripe" },
  { providerId: "twilio", displayName: "Twilio" },
  { providerId: "shopify", displayName: "Shopify" },
  { providerId: "mailchimp", displayName: "Mailchimp" },
  { providerId: "zendesk", displayName: "Zendesk" },
  { providerId: "intercom", displayName: "Intercom" },
  { providerId: "figma", displayName: "Figma" },
  { providerId: "supabase", displayName: "Supabase" },
  { providerId: "snowflake", displayName: "Snowflake" },
  { providerId: "datadog", displayName: "Datadog" },
  // long-tail / no-curated-slug → derived slug or monogram fallback
  { providerId: "acme-erp", displayName: "Acme ERP" },
  { providerId: "internal-billing", displayName: "Internal Billing" },
];

function Interactive(props: { connected?: IntegrationConnection[] }) {
  const [connections, setConnections] = useState<IntegrationConnection[]>(
    props.connected ?? [],
  );
  return (
    <IntegrationsPanel
      catalog={catalog}
      connections={connections}
      onConnect={({ providerId, connectorId }) =>
        setConnections((c) => [
          ...c,
          {
            id: `conn_${providerId}`,
            providerId,
            connectorId,
            status: "connected",
          },
        ])
      }
      onDisconnect={(id) =>
        setConnections((c) => c.filter((conn) => conn.id !== id))
      }
    />
  );
}

export const Default: Story = { render: () => <Interactive /> };

export const WithConnections: Story = {
  render: () => (
    <Interactive
      connected={[
        {
          id: "conn_slack",
          providerId: "slack",
          connectorId: "slack",
          status: "connected",
          accountDisplay: "tangle.slack.com",
        },
        {
          id: "conn_github",
          providerId: "github",
          connectorId: "github",
          status: "connected",
          accountDisplay: "octocat",
        },
      ]}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <IntegrationsPanel
      catalog={[]}
      connections={[]}
      isLoading
      onConnect={() => {}}
      onDisconnect={() => {}}
    />
  ),
};
