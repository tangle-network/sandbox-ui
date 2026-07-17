import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorActionList } from "./action-list";
import type { ConnectorAction } from "./types";

const actions: ConnectorAction[] = [
  {
    path: "github.issues.create",
    title: "GitHub: Create issue",
    description: "Open a new issue on a repository",
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        title: { type: "string" },
      },
      required: ["owner", "title"],
    },
    outputSchema: {
      type: "object",
      properties: { number: { type: "integer" } },
    },
  },
  {
    path: "github.issues.list",
    title: "GitHub: List issues",
    description: "List issues on a repository",
    risk: "read",
    inputSchema: { type: "object", properties: { owner: { type: "string" } } },
  },
  {
    path: "github.repos.delete",
    title: "GitHub: Delete repository",
    risk: "destructive",
  },
  {
    // No title and no risk — falls back to the path, badge is "unclassified".
    path: "github.meta.ping",
  },
];

describe("ConnectorActionList", () => {
  it("renders the count and strips the provider prefix from titles", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);

    expect(screen.getByRole("status")).toHaveTextContent("4 of 4 actions");
    // Prefix "GitHub: " stripped from the display title.
    expect(
      screen.getByRole("button", { name: /Create issue/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("GitHub: Create issue")).toBeNull();
  });

  it("suffixes the total with + when the list may be truncated", () => {
    render(
      <ConnectorActionList
        actions={actions}
        providerTitle="GitHub"
        maybeTruncated
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("4 of 4+ actions");
  });

  it("labels an unclassified action's risk badge", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);
    expect(screen.getByText("unclassified")).toBeInTheDocument();
  });

  it("expands a row to reveal the path, schema, and copy affordances", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);

    fireEvent.click(screen.getByRole("button", { name: /Create issue/ }));

    expect(screen.getByText("github.issues.create")).toBeInTheDocument();
    // The input schema table renders the action's fields.
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy path/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy step YAML/ }),
    ).toBeInTheDocument();
  });

  it("copies the path and confirms, then surfaces failure visibly", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: /Create issue/ }));

    const copyPath = screen.getByRole("button", { name: /Copy path/ });
    fireEvent.click(copyPath);
    await screen.findByRole("button", { name: /Copied/ });
    expect(writeText).toHaveBeenCalledWith("github.issues.create");

    // A clipboard rejection (insecure context / denied permission) shows a
    // visible "Copy failed" state instead of silently reverting.
    writeText.mockRejectedValueOnce(new Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: /Copy step YAML/ }));
    await screen.findByRole("button", { name: /Copy failed/ });
  });

  it("keeps only one row expanded at a time", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);

    const createRow = screen.getByRole("button", { name: /Create issue/ });
    fireEvent.click(createRow);
    expect(createRow).toHaveAttribute("aria-expanded", "true");

    const listRow = screen.getByRole("button", { name: /List issues/ });
    fireEvent.click(listRow);
    expect(listRow).toHaveAttribute("aria-expanded", "true");
    expect(createRow).toHaveAttribute("aria-expanded", "false");
  });

  it("fires onBuildWithAssistant with the expanded action", () => {
    const onBuild = vi.fn();
    render(
      <ConnectorActionList
        actions={actions}
        providerTitle="GitHub"
        onBuildWithAssistant={onBuild}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create issue/ }));
    fireEvent.click(screen.getByRole("button", { name: "Build with assistant" }));

    expect(onBuild).toHaveBeenCalledWith(
      expect.objectContaining({ path: "github.issues.create" }),
    );
  });

  it("does not render Build with assistant when the callback is absent", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: /Create issue/ }));
    expect(
      screen.queryByRole("button", { name: "Build with assistant" }),
    ).toBeNull();
  });

  it("narrows the list by the filter and clears it from the empty state", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);

    const filter = screen.getByRole("searchbox", { name: "Filter actions" });
    fireEvent.change(filter, { target: { value: "delete" } });

    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 actions");
    expect(
      screen.getByRole("button", { name: /Delete repository/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create issue/ })).toBeNull();

    fireEvent.change(filter, { target: { value: "zzz-nomatch" } });
    expect(screen.getByText("No actions match your filter.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(
      screen.getByRole("button", { name: /Create issue/ }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when the connector exposes no actions", () => {
    render(<ConnectorActionList actions={[]} providerTitle="GitHub" />);
    expect(
      screen.getByText(
        "This connector doesn't expose any invokable actions yet.",
      ),
    ).toBeInTheDocument();
  });

  it("matches actions on path and description as well as title", () => {
    render(<ConnectorActionList actions={actions} providerTitle="GitHub" />);
    const filter = screen.getByRole("searchbox", { name: "Filter actions" });

    // "repository" appears in a description, not a display title.
    fireEvent.change(filter, { target: { value: "new issue" } });
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /Create issue/ }),
    ).toBeInTheDocument();
  });
});
