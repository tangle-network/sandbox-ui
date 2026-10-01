import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationsCatalog } from "./integrations-catalog";
import { IntegrationConnectionDetail } from "./connection-detail";
import { ApiKeyConnectDialog, OAuthConnectionParameterDialog } from "./connection-dialogs";
import { IntegrationsPanel } from "./integrations-panel";
import type { IntegrationDisplayConnection, IntegrationPermissionGroup, IntegrationsCatalogProps, IntegrationsProviderRow } from "./types";

afterEach(cleanup);
const accounts: IntegrationDisplayConnection[] = ["account/one", "account/two"].map((id) => ({
  id, accountDisplay: "Same display name", statusLabel: "Connected",
  capabilities: { manage: true, disconnect: true, test: true, editPermissions: true, resetPermissions: true },
  manageHref: `/settings/connections/${encodeURIComponent(id)}`,
}));
const provider: IntegrationsProviderRow = {
  kind: "provider", providerId: "slack", title: "Slack", category: "Chat",
  connections: accounts, selectedConnectionId: null, canConnect: true,
};
const catalogProps: IntegrationsCatalogProps = {
  rows: [provider], query: "", onQueryChange: () => {}, onSelectConnection: () => {},
};
const groups: IntegrationPermissionGroup[] = [{
  id: "sensitive", title: "Sensitive actions", rows: [{
    actionPath: "messages.send", title: "Send a message", riskLabel: "Write",
    decision: null, sourceLabel: "Not resolved by the owner", canReset: true,
    decisionOptions: [{ value: "deny", label: "Deny" }, { value: "ask", label: "Ask" }],
  }],
}];

describe("controlled catalog", () => {
  it("never chooses between accounts, even with identical display names", () => {
    const select = vi.fn();
    const disconnect = vi.fn();
    const { rerender } = render(<IntegrationsCatalog {...catalogProps} onSelectConnection={select} onDisconnect={disconnect} />);
    const selector = screen.getByRole("combobox", { name: "Account for Slack" });
    expect(selector).toHaveValue("");
    expect(within(selector).getByRole("option", { name: "Same display name · account/one" })).toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: "Same display name · account/two" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage" })).toBeNull();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
    fireEvent.change(selector, { target: { value: "account/two" } });
    expect(select).toHaveBeenCalledWith("slack", "account/two");
    expect(selector).toHaveValue("");
    rerender(<IntegrationsCatalog {...catalogProps} rows={[{ ...provider, selectedConnectionId: "account/two" }]} />);
    expect(screen.getByTestId("manage-slack")).toHaveAttribute("href", "/settings/connections/account%2Ftwo");
    expect(screen.getByTestId("manage-slack")).not.toHaveAttribute("target");
    rerender(<IntegrationsCatalog {...catalogProps} rows={[{ ...provider, connections: [accounts[0]!], selectedConnectionId: "account/two" }]} />);
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.queryByTestId("manage-slack")).toBeNull();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("requires both the capability and callback for actions; request is optional in every state", () => {
    const { rerender } = render(<IntegrationsCatalog {...catalogProps} rows={[{
      ...provider, selectedConnectionId: "account/one", connections: [{ ...accounts[0]!, capabilities: {} }],
    }]} onManage={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.queryByText("Manage")).toBeNull();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
    for (const state of [{}, { loading: true, rows: [] }, { rows: [] }, { error: "Cannot load" }]) {
      rerender(<IntegrationsCatalog {...catalogProps} {...state} />);
      expect(screen.queryByRole("button", { name: /Request/ })).toBeNull();
    }
    const request = vi.fn();
    rerender(<IntegrationsCatalog {...catalogProps} rows={[]} query="  Calendar  " onRequestIntegration={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Request an integration" }));
    expect(request).toHaveBeenCalledWith("Calendar");
  });

  it("retains the toolbar DOM and full-width frame through loading, loaded, error and empty", () => {
    const { rerender } = render(<IntegrationsCatalog {...catalogProps} rows={[]} loading skeletonCount={3} />);
    const search = screen.getByRole("textbox", { name: "Search integrations" });
    const frame = screen.getByRole("region", { name: "Integrations" });
    expect(screen.getByTestId("integrations-catalog-grid").children).toHaveLength(3);
    for (const state of [{ rows: [provider] }, { rows: [provider], error: "Load failed" }, { rows: [] }]) {
      rerender(<IntegrationsCatalog {...catalogProps} {...state} />);
      expect(screen.getByRole("textbox", { name: "Search integrations" })).toBe(search);
      expect(screen.getByRole("region", { name: "Integrations" })).toBe(frame);
      expect(frame).toHaveClass("w-full", "min-w-0");
    }
  });

  it("lets filters reveal hidden accounts and uses only supplied app destinations", () => {
    const query = vi.fn();
    const category = vi.fn();
    const { rerender } = render(<IntegrationsCatalog {...catalogProps} query="missing" categoryFilter="Gone"
      onQueryChange={query} onCategoryFilterChange={category} />);
    expect(screen.getByText(/1 active integrations are hidden/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(query).toHaveBeenCalledWith("");
    expect(category).toHaveBeenCalledWith("");
    const connect = vi.fn();
    rerender(<IntegrationsCatalog {...catalogProps} rows={[{
      kind: "app", providerId: "github-app", logoProviderId: "github", title: "GitHub App", installedCount: 2, to: "/settings/github-app",
    }]} onConnect={connect} />);
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/settings/github-app");
    expect(screen.getByText("Installed · 2 accounts")).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });
});

describe("controlled connection detail", () => {
  it("requires explicit selection and never infers a policy from risk", () => {
    const change = vi.fn();
    const reset = vi.fn();
    const test = vi.fn();
    const props = {
      provider, connections: accounts, selectedConnectionId: null, onSelectConnection: vi.fn(),
      detailsByConnectionId: { "account/one": { permissionGroups: groups, testResult: { message: "Only account one tested", tone: "success" as const } } },
      onDecisionChange: change, onResetDecision: reset, onTestConnection: test,
    };
    const { rerender } = render(<IntegrationConnectionDetail {...props} />);
    expect(screen.queryByText("Send a message")).toBeNull();
    rerender(<IntegrationConnectionDetail {...props} selectedConnectionId="account/one" />);
    const decision = screen.getByRole("combobox", { name: "Decision for messages.send" });
    expect(decision).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Allow" })).toBeNull();
    fireEvent.change(decision, { target: { value: "ask" } });
    expect(change).toHaveBeenCalledWith("account/one", "messages.send", "ask");
    fireEvent.click(screen.getByRole("button", { name: "Reset messages.send" }));
    expect(reset).toHaveBeenCalledWith("account/one", "messages.send");
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(test).toHaveBeenCalledWith("account/one");
    rerender(<IntegrationConnectionDetail {...props} selectedConnectionId="account/two" />);
    expect(screen.queryByText("Send a message")).toBeNull();
    expect(screen.queryByText("Only account one tested")).toBeNull();
    expect(screen.getByText("Connection settings are not available yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(test).toHaveBeenLastCalledWith("account/two");
    rerender(<IntegrationConnectionDetail {...props} selectedConnectionId="removed" />);
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
  });

  it("does not expose editing, reset, test or disconnect without capabilities", () => {
    render(<IntegrationConnectionDetail provider={provider} connections={[{ ...accounts[0]!, capabilities: {} }]}
      selectedConnectionId="account/one" onSelectConnection={vi.fn()}
      detailsByConnectionId={{ "account/one": { permissionGroups: groups } }}
      onDecisionChange={vi.fn()} onResetDecision={vi.fn()} onTestConnection={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.queryByRole("combobox", { name: /Decision/ })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });
});

function DialogHarness({ oauth = false, busy = false }: { oauth?: boolean; busy?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const shared = { open, busy, onOpenChange: setOpen, providerId: "slack", title: "Slack", error, onSubmit: () => setError("Rejected by the owner") };
  return <><button onClick={() => setOpen(true)}>Open connection</button>
    {oauth ? <OAuthConnectionParameterDialog {...shared} parameters={[{ key: "workspace", label: "Workspace", description: "Your workspace name", required: true }]}
      values={{ workspace: value }} onValueChange={(_, next) => setValue(next)} /> :
      <ApiKeyConnectDialog {...shared} value={value} onValueChange={setValue} />}
  </>;
}

describe("shared controlled dialogs", () => {
  it.each([false, true])("labels inputs, requires nonblank fields, surfaces owner error and restores keyboard focus (oauth=%s)", async (oauth) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DialogHarness oauth={oauth} />);
    const opener = screen.getByRole("button", { name: "Open connection" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Connect Slack" });
    const field = within(dialog).getByLabelText(oauth ? "Workspace" : "API key", { exact: true });
    expect(field).toHaveFocus();
    const submit = within(dialog).getByRole("button", { name: oauth ? "Continue" : "Connect", exact: true });
    expect(submit).toBeDisabled();
    await user.type(field, "   ");
    expect(submit).toBeDisabled();
    await user.type(field, "fixture-only");
    await user.click(submit);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Rejected by the owner");
    expect(screen.getByRole("dialog")).toBe(dialog);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("keeps cancellation available while a caller request is busy", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DialogHarness busy />);
    await user.click(screen.getByRole("button", { name: "Open connection" }));
    expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("only changes the controlled key through its callback and resets reveal on reopen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open connection" }));
    expect(screen.getByLabelText("API key", { exact: true })).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show API key" }));
    expect(screen.getByLabelText("API key", { exact: true })).toHaveAttribute("type", "text");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Open connection" }));
    expect(screen.getByLabelText("API key", { exact: true })).toHaveAttribute("type", "password");
  });
});

it("the legacy facade keeps every account, routes exact IDs, and does not retarget after removal", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const disconnect = vi.fn();
  const connections = accounts.map((account) => ({ id: account.id, providerId: "slack", status: "connected", accountDisplay: account.accountDisplay }));
  const props = { catalog: [{ providerId: "slack", displayName: "Slack" }], connections, onConnect: vi.fn(), onDisconnect: disconnect };
  const { rerender } = render(<IntegrationsPanel {...props} />);
  expect(screen.queryByTestId("menu-slack")).toBeNull();
  await user.selectOptions(screen.getByRole("combobox", { name: "Account for Slack" }), "account/two");
  await user.click(screen.getByTestId("menu-slack"));
  await user.click(screen.getByTestId("disconnect-slack"));
  await user.click(screen.getByTestId("confirm-disconnect"));
  expect(disconnect).toHaveBeenCalledWith("account/two");
  rerender(<IntegrationsPanel {...props} connections={[connections[0]!]} />);
  expect(screen.getByRole("combobox", { name: "Account for Slack" })).toHaveValue("");
  expect(screen.queryByTestId("menu-slack")).toBeNull();
});
