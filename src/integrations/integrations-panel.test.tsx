import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntegrationsPanel } from "./integrations-panel";
import type { IntegrationConnection, IntegrationProvider } from "./types";

const catalog: IntegrationProvider[] = [
  {
    providerId: "google",
    displayName: "Google Workspace",
    description: "Gmail, Drive, Calendar",
    connectors: [{ connectorId: "gmail", displayName: "Gmail" }],
  },
  {
    providerId: "slack",
    displayName: "Slack",
    connectors: [{ connectorId: "slack" }],
  },
];

describe("IntegrationsPanel", () => {
  it("renders one tile per catalog provider", () => {
    render(
      <IntegrationsPanel
        catalog={catalog}
        connections={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Google Workspace")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("renders Connect button for providers with no live connection", () => {
    const onConnect = vi.fn();
    render(
      <IntegrationsPanel
        catalog={catalog}
        connections={[]}
        onConnect={onConnect}
        onDisconnect={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("connect-google"));
    expect(onConnect).toHaveBeenCalledWith({
      providerId: "google",
      connectorId: "gmail",
    });
  });

  it("renders Disconnect button for providers with a live connection", () => {
    const onDisconnect = vi.fn();
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
        account: { displayName: "alice@example.com" },
      },
    ];
    render(
      <IntegrationsPanel
        catalog={catalog}
        connections={live}
        onConnect={() => {}}
        onDisconnect={onDisconnect}
      />,
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("disconnect-google"));
    expect(onDisconnect).toHaveBeenCalledWith("conn_1");
  });

  it("ignores revoked connections when deciding which tile to show as live", () => {
    render(
      <IntegrationsPanel
        catalog={catalog}
        connections={[
          {
            id: "conn_x",
            providerId: "google",
            connectorId: "gmail",
            status: "revoked",
          },
        ]}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByTestId("connect-google")).toBeInTheDocument();
    expect(screen.queryByTestId("disconnect-google")).toBeNull();
  });

  it("surfaces an error message when error is set", () => {
    render(
      <IntegrationsPanel
        catalog={[]}
        connections={[]}
        error={new Error("boom")}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(
      screen.getByText(/Failed to load integrations: boom/),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the catalog is empty and not loading", () => {
    render(
      <IntegrationsPanel
        catalog={[]}
        connections={[]}
        emptyCatalogLabel="Nothing here yet"
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders the health badge when healthByConnectionId is supplied", () => {
    const live: IntegrationConnection[] = [
      {
        id: "c1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    render(
      <IntegrationsPanel
        catalog={catalog}
        connections={live}
        healthByConnectionId={{ c1: { connectionId: "c1", status: "degraded" } }}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("degraded")).toBeInTheDocument();
  });
});
