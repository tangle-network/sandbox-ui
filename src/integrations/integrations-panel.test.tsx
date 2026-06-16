import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

function renderPanel(
  props: Partial<React.ComponentProps<typeof IntegrationsPanel>> = {},
) {
  return render(
    <IntegrationsPanel
      catalog={catalog}
      connections={[]}
      onConnect={() => {}}
      onDisconnect={() => {}}
      {...props}
    />,
  );
}

describe("IntegrationsPanel", () => {
  it("renders one logo tile per catalog provider", () => {
    renderPanel();
    expect(screen.getByText("Google Workspace")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("connects on click for providers with no live connection (no connect button)", () => {
    const onConnect = vi.fn();
    renderPanel({ onConnect });
    // No dedicated connect button — the tile itself is the click target.
    expect(screen.queryByRole("button", { name: /^connect$/i })).toBeNull();
    fireEvent.click(screen.getByTestId("integration-google"));
    expect(onConnect).toHaveBeenCalledWith({
      providerId: "google",
      connectorId: "gmail",
    });
  });

  it("renders a connected tile as disabled (not a connect button) with a hover-reveal manage affordance", () => {
    const onConnect = vi.fn();
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
    renderPanel({ connections: live, onConnect, onDisconnect });

    const tile = screen.getByTestId("integration-google");
    expect(tile).toHaveAttribute("data-connected", "true");
    // Clicking a connected tile must NOT re-initiate connect.
    fireEvent.click(tile);
    expect(onConnect).not.toHaveBeenCalled();

    // The manage affordance (gear) triggers disconnect/manage.
    fireEvent.click(screen.getByTestId("manage-google"));
    expect(onDisconnect).toHaveBeenCalledWith("conn_1");

    // Hover-reveal pattern: gear is opacity-0 until group-hover.
    expect(screen.getByTestId("manage-google").className).toContain(
      "group-hover:opacity-100",
    );

    // Slack (unconnected) remains clickable to connect.
    fireEvent.click(screen.getByTestId("integration-slack"));
    expect(onConnect).toHaveBeenCalledWith({
      providerId: "slack",
      connectorId: "slack",
    });
  });

  it("treats revoked connections as not live", () => {
    const onConnect = vi.fn();
    renderPanel({
      onConnect,
      connections: [
        {
          id: "conn_x",
          providerId: "google",
          connectorId: "gmail",
          status: "revoked",
        },
      ],
    });
    const tile = screen.getByTestId("integration-google");
    expect(tile).toHaveAttribute("data-connected", "false");
    fireEvent.click(tile);
    expect(onConnect).toHaveBeenCalled();
  });

  it("filters the grid by the search query (name, id, and description)", () => {
    renderPanel();
    const input = screen.getByTestId("integration-search");

    fireEvent.change(input, { target: { value: "slack" } });
    expect(screen.getByTestId("integration-slack")).toBeInTheDocument();
    expect(screen.queryByTestId("integration-google")).toBeNull();

    // Description match: "Calendar" only appears in google's description.
    fireEvent.change(input, { target: { value: "calendar" } });
    expect(screen.getByTestId("integration-google")).toBeInTheDocument();
    expect(screen.queryByTestId("integration-slack")).toBeNull();

    fireEvent.change(input, { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("orders featured providers first by default, before the alpha tail", () => {
    const wide: IntegrationProvider[] = [
      { providerId: "aardvark", displayName: "Aardvark" },
      { providerId: "slack", displayName: "Slack" },
      { providerId: "zzz", displayName: "Zzz" },
    ];
    const { container } = render(
      <IntegrationsPanel
        catalog={wide}
        connections={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        featuredIds={["slack"]}
      />,
    );
    const grid = container.querySelector(".grid.grid-cols-3") as HTMLElement;
    const tiles = within(grid)
      .getAllByText(/Aardvark|Slack|Zzz/)
      .map((el) => el.textContent);
    // Featured "Slack" leads; remaining ("Aardvark","Zzz") alpha-sorted.
    expect(tiles).toEqual(["Slack", "Aardvark", "Zzz"]);
  });

  it("switches to pure alphabetical order via the A–Z sort control", () => {
    const wide: IntegrationProvider[] = [
      { providerId: "aardvark", displayName: "Aardvark" },
      { providerId: "slack", displayName: "Slack" },
    ];
    const { container } = render(
      <IntegrationsPanel
        catalog={wide}
        connections={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        featuredIds={["slack"]}
      />,
    );
    fireEvent.click(screen.getByTestId("sort-alpha"));
    const grid = container.querySelector(".grid.grid-cols-3") as HTMLElement;
    const tiles = within(grid)
      .getAllByText(/Aardvark|Slack/)
      .map((el) => el.textContent);
    expect(tiles).toEqual(["Aardvark", "Slack"]);
  });

  it("surfaces an error message when error is set", () => {
    renderPanel({ catalog: [], error: new Error("boom") });
    expect(
      screen.getByText(/Failed to load integrations: boom/),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the catalog is empty and not loading", () => {
    renderPanel({ catalog: [], emptyCatalogLabel: "Nothing here yet" });
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });
});
