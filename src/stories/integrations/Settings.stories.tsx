import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "@tangle-network/ui/primitives";
import {
  IntegrationsCatalog, IntegrationConnectionDetail, ApiKeyConnectDialog, OAuthConnectionParameterDialog,
} from "../../integrations";
import type { IntegrationDisplayConnection, IntegrationPermissionGroup, IntegrationsCatalogRow } from "../../integrations";
import { providerLogos } from "./fixtures/provider-logos";

const meta: Meta = {
  title: "Integrations/Settings",
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen bg-background p-4 text-foreground sm:p-8"><div className="mx-auto w-full min-w-0 max-w-5xl"><Story /></div></div>],
};
export default meta;
type Story = StoryObj;
type State = "loading" | "loaded" | "empty" | "error";
const states: State[] = ["loading", "loaded", "empty", "error"];
function States({ value, onChange }: { value: State; onChange: (state: State) => void }) {
  return <div className="mb-4 flex flex-wrap gap-2" aria-label="Fixture state">
    {states.map((state) => <Button key={state} variant="outline" aria-pressed={state === value} onClick={() => onChange(state)}>{state}</Button>)}
  </div>;
}
const accounts: IntegrationDisplayConnection[] = ["team/one", "team/two"].map((id, i) => ({
  id, accountDisplay: `Team ${i + 1} · operations@example.test`, statusLabel: i ? "Needs reconnect" : "Connected",
  statusTone: i ? "warning" : "success", capabilities: { manage: true, disconnect: true, test: true, editPermissions: true, resetPermissions: true },
  manageHref: `/settings/connections/${encodeURIComponent(id)}`,
}));
const providers = ["slack", "github", "notion", "linear", "gmail", "google-drive"];
function CatalogScene({ geometry = false, initial = "loaded" }: { geometry?: boolean; initial?: State }) {
  const [state, setState] = useState<State>(initial);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("No action");
  const rows: IntegrationsCatalogRow[] = providers.map((id) => ({
    kind: "provider", providerId: id, title: id === "slack" ? "Slack" : id,
    category: id === "slack" ? "Communication" : "Productivity", iconUrl: providerLogos[id],
    canConnect: true, connections: !geometry && id === "slack" ? accounts : [],
    selectedConnectionId: id === "slack" ? selected : null,
  }));
  if (!geometry) rows.push({ kind: "app", providerId: "github-app", title: "GitHub App", logoProviderId: "github", iconUrl: providerLogos.github,
    installedCount: 2, category: "Development", to: "/settings/github-app" });
  return <><States value={state} onChange={setState} />
    <IntegrationsCatalog rows={state === "loaded" ? rows : []} query={query} onQueryChange={setQuery}
      categoryFilter={category} onCategoryFilterChange={setCategory} skeletonCount={6}
      loading={state === "loading"} error={state === "error" ? "Fixture catalog load failed. Retry is available." : null}
      onRetry={() => setState("loaded")} title="Agent access" description="Display fixture only; connections and destinations belong to the application."
      onSelectConnection={(_, id) => { setSelected(id); setReceipt(`selected:${id}`); }}
      onConnect={(row) => setReceipt(`connect:${row.providerId}`)}
      onDisconnect={(connection) => setReceipt(`disconnect:${connection.id}`)} />
    <output className="mt-4 block break-all text-sm text-muted-foreground" data-testid="settings-receipt">{receipt}</output>
  </>;
}
function permissions(id: string): IntegrationPermissionGroup[] {
  return [{ id: "sensitive", title: "Writes and sensitive actions", description: "These decisions are explicit fixture data, not package defaults.", rows: [{
    actionPath: "messages.send", title: `Send a message · ${id}`, riskLabel: "Write", riskTone: "warning", decision: "ask",
    sourceLabel: "Owner-supplied decision", canReset: true,
    decisionOptions: [{ value: "ask", label: "Ask" }, { value: "deny", label: "Deny" }],
  }] }, { id: "read", title: "Read actions", collapsed: true, rows: [{
    actionPath: "messages.list", title: "List messages", riskLabel: "Read", decision: "deny", sourceLabel: "Override", canReset: true,
    decisionOptions: [{ value: "deny", label: "Deny" }],
  }] }];
}
function DetailScene({ initial = "loaded", initialSelected = null }: { initial?: State; initialSelected?: string | null }) {
  const [state, setState] = useState<State>(initial);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [receipt, setReceipt] = useState("No action");
  return <><States value={state} onChange={setState} />
    <IntegrationConnectionDetail provider={{ providerId: "slack", title: "Slack", iconUrl: providerLogos.slack }}
      connections={state === "empty" || state === "loading" ? [] : accounts} selectedConnectionId={selected} onSelectConnection={setSelected}
      loading={state === "loading"} error={state === "error" ? "Fixture settings load failed." : null}
      description="Select an account. Callbacks record a fixture receipt; nothing is persisted."
      detailsByConnectionId={{ "team/one": { permissionGroups: permissions("team/one") }, "team/two": { permissionGroups: permissions("team/two") } }}
      onRetry={() => setState("loaded")} onTestConnection={(id) => setReceipt(`test:${id}`)}
      onDisconnect={(id) => setReceipt(`disconnect:${id}`)}
      onDecisionChange={(id, path, decision) => setReceipt(`decision:${id}:${path}:${decision}`)}
      onResetDecision={(id, path) => setReceipt(`reset:${id}:${path}`)} />
    <output className="mt-4 block break-all text-sm text-muted-foreground" data-testid="settings-receipt">{receipt}</output>
  </>;
}
function DialogScene({ initialKind = null }: { initialKind?: "key" | "oauth" | null }) {
  const [kind, setKind] = useState<"key" | "oauth" | null>(initialKind);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = (next: "key" | "oauth") => { setValue(""); setError(null); setKind(next); };
  const onOpenChange = (visible: boolean) => { if (!visible) { setKind(null); setValue(""); setError(null); } };
  const shared = { providerId: "slack", title: "Slack", onOpenChange, error, onSubmit: () => setError("Fixture rejection: the owner has not accepted this connection.") };
  return <div className="flex flex-wrap gap-3">
    <Button variant="outline" onClick={() => open("key")}>Open API-key dialog</Button>
    <Button variant="outline" onClick={() => open("oauth")}>Open OAuth-parameter dialog</Button>
    <ApiKeyConnectDialog {...shared} open={kind === "key"} value={value} onValueChange={setValue} />
    <OAuthConnectionParameterDialog {...shared} open={kind === "oauth"} values={{ workspace: value }} onValueChange={(_, next) => setValue(next)}
      parameters={[{ key: "workspace", label: "Workspace", description: "The application's requested workspace parameter.", required: true }]} />
  </div>;
}
export const CatalogLight: Story = { globals: { sandboxTheme: "light" }, render: () => <CatalogScene /> };
export const CatalogDark: Story = { globals: { sandboxTheme: "dark" }, render: () => <CatalogScene /> };
export const CatalogLoading: Story = { render: () => <CatalogScene initial="loading" /> };
export const CatalogEmpty: Story = { render: () => <CatalogScene initial="empty" /> };
export const CatalogError: Story = { render: () => <CatalogScene initial="error" /> };
export const Geometry: Story = { render: () => <CatalogScene geometry initial="loading" /> };
export const DetailLight: Story = { globals: { sandboxTheme: "light" }, render: () => <DetailScene /> };
export const DetailDark: Story = { globals: { sandboxTheme: "dark" }, render: () => <DetailScene /> };
export const DetailSelected: Story = { render: () => <DetailScene initialSelected="team/two" /> };
export const DetailLoading: Story = { render: () => <DetailScene initial="loading" /> };
export const DetailEmpty: Story = { render: () => <DetailScene initial="empty" /> };
export const DetailError: Story = { render: () => <DetailScene initial="error" /> };
export const Dialogs: Story = { render: () => <DialogScene /> };
export const DialogApiKey: Story = { render: () => <DialogScene initialKind="key" /> };
export const DialogOAuth: Story = { render: () => <DialogScene initialKind="oauth" /> };
