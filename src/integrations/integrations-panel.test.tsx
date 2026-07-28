import { describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders a connected tile (not a connect button) and disconnects only after confirming in the dialog", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
        accountDisplay: "alice@example.com",
      },
    ];
    renderPanel({ connections: live, onConnect, onDisconnect });

    const tile = screen.getByTestId("integration-google");
    expect(tile).toHaveAttribute("data-connected", "true");
    // The tile shows which account is linked, under the provider name.
    expect(screen.getByTestId("account-google")).toHaveTextContent(
      "alice@example.com",
    );
    // Clicking a connected tile must NOT re-initiate connect.
    fireEvent.click(tile);
    expect(onConnect).not.toHaveBeenCalled();

    // Disconnect lives in the overflow menu now; opening it then choosing
    // Disconnect opens a confirmation dialog rather than disconnecting outright.
    await user.click(screen.getByTestId("menu-google"));
    await user.click(screen.getByTestId("disconnect-google"));
    expect(onDisconnect).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Disconnect Google Workspace/),
    ).toBeInTheDocument();
    // The connected account identity is surfaced in the confirmation copy.
    expect(within(dialog).getByText(/alice@example\.com/)).toBeInTheDocument();

    await user.click(within(dialog).getByTestId("confirm-disconnect"));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith("conn_1"));

    // Slack (unconnected) remains clickable to connect.
    fireEvent.click(screen.getByTestId("integration-slack"));
    expect(onConnect).toHaveBeenCalledWith({
      providerId: "slack",
      connectorId: "slack",
    });
  });

  it("renders the connected account when present and nothing extra when absent", () => {
    renderPanel({
      connections: [
        {
          id: "c1",
          providerId: "google",
          connectorId: "gmail",
          status: "connected",
          accountDisplay: "alice@example.com",
        },
        {
          id: "c2",
          providerId: "slack",
          connectorId: "slack",
          status: "connected",
          // no accountDisplay → graceful: no extra line
        },
      ],
    });
    expect(screen.getByTestId("account-google")).toHaveTextContent(
      "alice@example.com",
    );
    expect(screen.queryByTestId("account-slack")).toBeNull();
  });

  it("keeps long connected account names inside narrow grid tiles", () => {
    renderPanel({
      connections: [
        {
          id: "c1",
          providerId: "google",
          connectorId: "gmail",
          status: "connected",
          accountDisplay:
            "relationship-operations-owner@long-company-domain.example",
        },
      ],
    });

    const tile = screen.getByTestId("integration-google");
    const account = screen.getByTestId("account-google");
    expect(tile).toHaveClass("min-w-0");
    expect(account).toHaveClass("truncate");
    expect(account.parentElement?.parentElement).toHaveClass(
      "w-full",
      "min-w-0",
    );
  });

  it("does not disconnect when the confirmation dialog is cancelled", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onDisconnect = vi.fn();
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({ connections: live, onDisconnect });

    await user.click(screen.getByTestId("menu-google"));
    await user.click(screen.getByTestId("disconnect-google"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("cancel-disconnect"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("lets the user escape the dialog while a disconnect is in flight", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    // A request that never settles must not trap the user in the dialog.
    const onDisconnect = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({ connections: live, onDisconnect });

    await user.click(screen.getByTestId("menu-google"));
    await user.click(screen.getByTestId("disconnect-google"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("confirm-disconnect"));
    expect(onDisconnect).toHaveBeenCalledWith("conn_1");

    // Cancel stays enabled mid-request and closes the dialog.
    await user.click(within(dialog).getByTestId("cancel-disconnect"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the dialog open and surfaces an error when disconnect fails", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onDisconnect = vi.fn().mockRejectedValue(new Error("network down"));
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({ connections: live, onDisconnect });

    await user.click(screen.getByTestId("menu-google"));
    await user.click(screen.getByTestId("disconnect-google"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("confirm-disconnect"));

    await waitFor(() =>
      expect(within(dialog).getByText(/network down/)).toBeInTheDocument(),
    );
    // The dialog stays open so the user can retry or cancel.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onDisconnect).toHaveBeenCalledWith("conn_1");
  });

  it("matches a provider-only connection that omits connectorId (platform hub shape)", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    // The platform hub keys connections by provider only: catalog providers
    // carry no connectors[] and connection rows carry no connectorId.
    const hubCatalog: IntegrationProvider[] = [
      { providerId: "slack", displayName: "Slack" },
    ];
    const live: IntegrationConnection[] = [
      { id: "conn_hub", providerId: "slack", status: "active" },
    ];
    renderPanel({
      catalog: hubCatalog,
      connections: live,
      onConnect,
      onDisconnect,
    });

    const tile = screen.getByTestId("integration-slack");
    expect(tile).toHaveAttribute("data-connected", "true");
    // Clicking an already-connected provider must not re-initiate OAuth.
    fireEvent.click(tile);
    expect(onConnect).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("menu-slack"));
    await user.click(screen.getByTestId("disconnect-slack"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("confirm-disconnect"));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith("conn_hub"));
  });

  it("makes the connected tile a Manage link (and a menu item) when getManageHref returns a URL", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({
      connections: live,
      getManageHref: (c) => `/integrations/${c.providerId}/manage`,
    });

    // The whole-tile Manage affordance is a real new-tab link.
    const tileLink = screen.getByTestId("manage-google");
    expect(tileLink.tagName).toBe("A");
    expect(tileLink).toHaveAttribute("href", "/integrations/google/manage");
    expect(tileLink).toHaveAttribute("target", "_blank");
    expect(tileLink).toHaveAttribute("rel", "noopener noreferrer");

    // The overflow menu also lists Manage explicitly (as a link).
    await user.click(screen.getByTestId("menu-google"));
    const menuItem = await screen.findByTestId("manage-item-google");
    expect(menuItem).toHaveAttribute("href", "/integrations/google/manage");
    expect(menuItem).toHaveAttribute("target", "_blank");
  });

  it("calls onManage from the menu when no manage href is provided", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onManage = vi.fn();
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({ connections: live, onManage });

    // No full-tile link without a resolvable URL — Manage is menu-only here.
    expect(screen.queryByTestId("manage-google")).toBeNull();

    await user.click(screen.getByTestId("menu-google"));
    await user.click(await screen.findByTestId("manage-item-google"));
    expect(onManage).toHaveBeenCalledWith({
      connectionId: "conn_1",
      providerId: "google",
    });
  });

  it("offers only Disconnect in the menu when neither manage prop is provided", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const live: IntegrationConnection[] = [
      {
        id: "conn_1",
        providerId: "google",
        connectorId: "gmail",
        status: "connected",
      },
    ];
    renderPanel({ connections: live });

    expect(screen.queryByTestId("manage-google")).toBeNull();
    await user.click(screen.getByTestId("menu-google"));
    expect(await screen.findByTestId("disconnect-google")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-item-google")).toBeNull();
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

  describe("a connect attempt that fails must say so", () => {
    // The common real failure: the provider's OAuth app has no credentials
    // wired, so the platform answers the start call with 503 and the
    // consumer's connect() rejects. Clicking used to produce an unhandled
    // promise rejection and no visible change at all.
    it("surfaces the rejection instead of doing nothing", async () => {
      const onConnect = vi
        .fn()
        .mockRejectedValue(
          new Error("Failed to start OAuth (503): Hub provider config missing"),
        );
      renderPanel({ onConnect });

      fireEvent.click(screen.getByTestId("integration-slack"));

      await waitFor(() => {
        expect(
          screen.getByTestId("integration-connect-error"),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(/503/);
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("marks the tile busy while the attempt is in flight", async () => {
      let release: (() => void) | undefined;
      const onConnect = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      renderPanel({ onConnect });

      const tile = screen.getByTestId("integration-slack");
      fireEvent.click(tile);

      await waitFor(() => {
        expect(screen.getByTestId("integration-slack")).toHaveAttribute(
          "data-connecting",
          "true",
        );
      });
      // A second click while the first is pending must not open two flows.
      fireEvent.click(screen.getByTestId("integration-slack"));
      expect(onConnect).toHaveBeenCalledTimes(1);

      release?.();
      await waitFor(() => {
        expect(screen.getByTestId("integration-slack")).not.toHaveAttribute(
          "data-connecting",
        );
      });
    });
  });
});
