import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IntegrationsCatalog, integrationConnectionTone, integrationTileStatus } from "./integrations-catalog";
import { IntegrationsPanel } from "./integrations-panel";
import type { IntegrationDisplayConnection, IntegrationsCatalogProps, IntegrationsCatalogRow, IntegrationsProviderRow } from "./types";

afterEach(cleanup);

const account = (id: string, extra: Partial<IntegrationDisplayConnection> = {}): IntegrationDisplayConnection => ({
  id, accountDisplay: `${id}@example.test`, statusLabel: "Connected", capabilities: { manage: true }, ...extra,
});
const provider = (providerId: string, extra: Partial<IntegrationsProviderRow> = {}): IntegrationsProviderRow => ({
  kind: "provider", providerId, title: providerId, connections: [], selectedConnectionId: null, canConnect: true, ...extra,
});
const rows: IntegrationsCatalogRow[] = [
  provider("slack", { connections: [account("a")], selectedConnectionId: "a" }),
  provider("github"),
  provider("notion", { connections: [account("b", { statusLabel: "Reconnect required", statusTone: "error" })], selectedConnectionId: "b" }),
  provider("linear", { connections: [account("c"), account("d")] }),
  provider("jira", { connections: [account("e", { statusLabel: "Pending approval", statusTone: "warning" })], selectedConnectionId: "e" }),
  { kind: "app", providerId: "github-app", title: "GitHub App", logoProviderId: "github", installedCount: 0, to: "/apps/github" },
];
const props: IntegrationsCatalogProps = { rows, query: "", onQueryChange: () => {}, onSelectConnection: () => {}, onConnect: () => {} };

describe("catalog tiles use the shared surface ladder", () => {
  for (const layout of ["cards", "tiles"] as const) {
    it(`renders every ${layout} tile as the ui Card, with no hand-painted background`, () => {
      render(<IntegrationsCatalog {...props} layout={layout} />);
      for (const row of rows) {
        const tile = screen.getByTestId(`integration-${row.providerId}`);
        // The brand's [data-slot="card"] rule owns the level, so a tile in a section card steps to raised.
        expect(tile).toHaveAttribute("data-slot", "card");
        const painted = tile.className.split(/\s+/).filter((name) => /^(hover:)?bg-(?!card$)/.test(name) || name.includes("surface-success"));
        expect(painted).toEqual([]);
      }
    });

    it(`renders ${layout} skeleton tiles as the ui Card too`, () => {
      render(<IntegrationsCatalog {...props} rows={[]} loading skeletonCount={2} layout={layout} />);
      const tiles = Array.from(screen.getByTestId("integrations-catalog-grid").children);
      expect(tiles).toHaveLength(2);
      for (const tile of tiles) {
        expect(tile).toHaveAttribute("data-slot", "card");
        expect(tile.className).not.toMatch(/bg-muted\/40/);
      }
    });
  }

  it("shows each connection state as its StatusPill tone, with amber only for pending", () => {
    render(<IntegrationsCatalog {...props} layout="tiles" busyProviderId="github" />);
    const expectations: Record<string, [string, string]> = {
      slack: ["success", "Connected"],
      github: ["warning", "Connecting…"],
      notion: ["danger", "Reconnect required"],
      linear: ["warning", "Select an account"],
      jira: ["warning", "Pending approval"],
      "github-app": ["neutral", "Not installed"],
    };
    for (const [id, [tone, label]] of Object.entries(expectations)) {
      const pill = screen.getByTestId(`status-${id}`);
      expect(pill).toHaveAttribute("data-tone", tone);
      expect(pill).toHaveTextContent(label);
    }
  });

  it("maps not connected to neutral, never warning", () => {
    expect(integrationConnectionTone("connected")).toBe("success");
    expect(integrationConnectionTone("not_connected")).toBe("neutral");
    expect(integrationConnectionTone("error")).toBe("danger");
    expect(integrationConnectionTone("pending")).toBe("warning");
    expect(integrationTileStatus(provider("github"))).toEqual({ state: "not_connected", label: "Not connected", tone: "neutral" });
    expect(integrationTileStatus(provider("github"), { connecting: true }).tone).toBe("warning");
    expect(integrationTileStatus(provider("x", { connections: [account("a", { statusTone: "neutral", statusLabel: "Paused" })], selectedConnectionId: "a" })).tone).toBe("neutral");
  });

  it("keeps a tile that connects as a whole keyboard-reachable through one Connect control", () => {
    const onConnect = vi.fn();
    render(<IntegrationsCatalog {...props} rows={[provider("github")]} onConnect={onConnect} layout="tiles" />);
    const tile = screen.getByTestId("integration-github");
    const control = within(tile).getByRole("button", { name: "Connect github" });
    fireEvent.click(control);
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ providerId: "github" }));
  });

  it("keeps card body copy to the status line; the description lives in the title attribute", () => {
    const description = "Send and read messages, manage channels, and post updates for your whole team.";
    render(<IntegrationsCatalog {...props} rows={[provider("slack", { description })]} />);
    const tile = screen.getByTestId("integration-slack");
    expect(tile).toHaveAttribute("title", description);
    expect(within(tile).queryByText(description)).toBeNull();
  });

  it("gives the legacy panel's tiles a tone from connection status and health", () => {
    render(<IntegrationsPanel
      catalog={[{ providerId: "slack" }, { providerId: "github" }, { providerId: "notion" }, { providerId: "linear" }]}
      connections={[
        { id: "c1", providerId: "slack", status: "connected" },
        { id: "c2", providerId: "github", status: "expired" },
        { id: "c3", providerId: "notion", status: "connected" },
      ]}
      healthByConnectionId={{ c3: { connectionId: "c3", status: "degraded", message: "Rate limited" } }}
      onConnect={() => {}} onDisconnect={() => {}} />);
    expect(screen.getByTestId("status-slack")).toHaveAttribute("data-tone", "success");
    expect(screen.getByTestId("status-slack")).toHaveTextContent("Connected");
    expect(screen.getByTestId("status-github")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByTestId("status-github")).toHaveTextContent("Expired");
    expect(screen.getByTestId("status-notion")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByTestId("status-notion")).toHaveTextContent("Rate limited");
    expect(screen.getByTestId("status-linear")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByTestId("status-linear")).toHaveTextContent("Not connected");
  });
});
