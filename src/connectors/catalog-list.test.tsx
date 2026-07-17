import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorCatalogList } from "./catalog-list";
import type { ConnectorCatalogEntry } from "./types";

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
    actionCount: 12,
    triggerCount: 0,
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
    actionCount: 1,
    triggerCount: 1,
  },
];

const href = (id: string) => `/c/${id}`;

describe("ConnectorCatalogList", () => {
  it("renders the count, one row per entry, and the detail line", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);

    expect(screen.getByRole("status")).toHaveTextContent("4 of 4 connectors");
    expect(screen.getAllByRole("link")).toHaveLength(4);
    // Category · Auth · N actions · M trigger events; trigger segment only when >0.
    expect(
      screen.getByText("Developer Tools · OAuth · 42 actions · 3 trigger events"),
    ).toBeInTheDocument();
    // Slack has no triggers — the trigger segment is omitted.
    expect(
      screen.getByText("Communication · OAuth · 12 actions"),
    ).toBeInTheDocument();
  });

  it("renders each row's href from getConnectorHref", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "/c/github",
    );
  });

  it("shows a Connected indicator only on connected rows", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);
    const githubRow = screen.getByRole("link", { name: /GitHub/ });
    expect(within(githubRow).getByText("Connected")).toBeInTheDocument();
    const slackRow = screen.getByRole("link", { name: /Slack/ });
    expect(within(slackRow).queryByText("Connected")).toBeNull();
  });

  it("filters by the search query (title or providerId)", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);
    const search = screen.getByRole("searchbox", { name: "Search connectors" });

    fireEvent.change(search, { target: { value: "slack" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 connectors");
    expect(screen.getByRole("link", { name: /Slack/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GitHub/ })).toBeNull();
  });

  it("filters by category and by auth type via the select controls", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by category" }),
      { target: { value: "dev" } },
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 of 4 connectors");
    expect(screen.getByRole("link", { name: /GitHub/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Linear/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Slack/ })).toBeNull();

    // Narrow further by auth: only Linear is dev + api_key.
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by auth type" }),
      { target: { value: "api_key" } },
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 connectors");
    expect(screen.getByRole("link", { name: /Linear/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GitHub/ })).toBeNull();
  });

  it("prefers onOpenConnector over the href on click", () => {
    const onOpen = vi.fn();
    render(
      <ConnectorCatalogList
        entries={entries}
        getConnectorHref={href}
        onOpenConnector={onOpen}
      />,
    );
    const link = screen.getByRole("link", { name: /GitHub/ });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const notPrevented = link.dispatchEvent(event);

    expect(onOpen).toHaveBeenCalledWith("github");
    // preventDefault was called so the browser would not follow the href.
    expect(notPrevented).toBe(false);
  });

  it("lets a modifier-click fall through to the href (open in new tab)", () => {
    const onOpen = vi.fn();
    render(
      <ConnectorCatalogList
        entries={entries}
        getConnectorHref={href}
        onOpenConnector={onOpen}
      />,
    );
    const link = screen.getByRole("link", { name: /GitHub/ });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    const notPrevented = link.dispatchEvent(event);

    // The browser follows the real href; SPA nav is not hijacked.
    expect(onOpen).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it("follows the href (no preventDefault) when onOpenConnector is absent", () => {
    render(
      <ConnectorCatalogList
        entries={entries}
        getConnectorHref={(id) => `#/c/${id}`}
      />,
    );
    const link = screen.getByRole("link", { name: /Linear/ });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const notPrevented = link.dispatchEvent(event);
    expect(notPrevented).toBe(true);
  });

  it("uses the host icon when renderIcon is provided", () => {
    render(
      <ConnectorCatalogList
        entries={entries}
        getConnectorHref={href}
        renderIcon={(id) => <span data-testid={`icon-${id}`}>icon</span>}
      />,
    );
    expect(screen.getByTestId("icon-github")).toBeInTheDocument();
  });

  it("shows the request affordance only when onRequestIntegration is provided", () => {
    const { rerender } = render(
      <ConnectorCatalogList entries={entries} getConnectorHref={href} />,
    );
    expect(
      screen.queryByRole("button", { name: "Request an integration" }),
    ).toBeNull();

    const onRequest = vi.fn();
    rerender(
      <ConnectorCatalogList
        entries={entries}
        getConnectorHref={href}
        onRequestIntegration={onRequest}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request an integration" }),
    );
    expect(onRequest).toHaveBeenCalledWith("");
  });

  it("clears filters from the no-match empty state", () => {
    render(<ConnectorCatalogList entries={entries} getConnectorHref={href} />);
    const search = screen.getByRole("searchbox", { name: "Search connectors" });

    fireEvent.change(search, { target: { value: "zzz-nomatch" } });
    expect(
      screen.getByText("No connectors match your filters."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 of 4 connectors");
  });

  it("resets a stale filter value that no longer appears in the options", () => {
    const { rerender } = render(
      <ConnectorCatalogList entries={entries} getConnectorHref={href} />,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by category" }),
      { target: { value: "finance" } },
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 connectors");

    // Refetch drops every "finance" entry; the stale selection must reset so
    // rows are not silently hidden with no control to recover them.
    const withoutFinance = entries.filter((e) => e.category !== "finance");
    rerender(
      <ConnectorCatalogList
        entries={withoutFinance}
        getConnectorHref={href}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("3 of 3 connectors");
  });

  it("shows an empty state when the catalog has no entries", () => {
    render(<ConnectorCatalogList entries={[]} getConnectorHref={href} />);
    expect(
      screen.getByText("No connectors are available yet."),
    ).toBeInTheDocument();
  });
});
