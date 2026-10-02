import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationsPanel } from "./integrations-panel";

it("reserves legacy context geometry for loading and every loaded tile", () => {
  const props = { catalog: [{ providerId: "slack", displayName: "Slack" }], connections: [],
    onConnect: vi.fn(), onDisconnect: vi.fn(), getConnectionContext: () => "Personal connection" };
  const { rerender } = render(<IntegrationsPanel {...props} catalog={[]} isLoading />);
  const grid = screen.getByTestId("integrations-catalog-grid");
  for (const tile of Array.from(grid.children)) expect(tile).toHaveClass("w-full", "min-h-[136px]");
  rerender(<IntegrationsPanel {...props} />);
  expect(screen.getByTestId("integration-slack")).toHaveClass("w-full", "min-h-[136px]");
});
