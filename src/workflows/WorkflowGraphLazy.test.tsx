// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The inner React-Flow graph is mocked so the lazy import resolves but the
// component's render outcome is controllable: `throw` exercises the error
// boundary + fallback, `ok` exercises a successful (re)render.
let graphMode: "throw" | "ok" = "throw";
vi.mock("./WorkflowGraph", () => ({
  WorkflowGraph: () => {
    if (graphMode === "throw") throw new Error("graph render boom");
    return <div data-testid="real-graph">graph</div>;
  },
}));

import { retryImport, WorkflowGraph } from "./WorkflowGraphLazy";

afterEach(() => {
  cleanup();
  graphMode = "throw";
});

describe("retryImport", () => {
  it("retries a transiently-failing import, then resolves", async () => {
    let calls = 0;
    const factory = vi.fn(() => {
      calls += 1;
      return calls < 3
        ? Promise.reject(new Error("blip"))
        : Promise.resolve("loaded");
    });
    await expect(retryImport(factory, 2, 1)).resolves.toBe("loaded");
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it("rejects after exhausting its retries", async () => {
    const factory = vi.fn(() => Promise.reject(new Error("gone")));
    await expect(retryImport(factory, 2, 1)).rejects.toThrow("gone");
    // initial attempt + 2 retries
    expect(factory).toHaveBeenCalledTimes(3);
  });
});

describe("WorkflowGraph (lazy) error recovery", () => {
  it("degrades to the YAML fallback with a Retry, then recovers when Retry succeeds", async () => {
    render(<WorkflowGraph yaml="name: demo-flow" variant="preview" />);

    // The inner graph throws on render → error boundary → YAML fallback.
    await screen.findByText(/Couldn't render the graph/i);
    // The workflow stays fully legible as YAML.
    expect(screen.getByText(/name: demo-flow/)).toBeTruthy();

    // Retry re-attempts; the next render succeeds and replaces the fallback.
    graphMode = "ok";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByTestId("real-graph");
    expect(screen.queryByText(/Couldn't render the graph/i)).toBeNull();
  });
});
