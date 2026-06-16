import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SystemLogsViewer } from "./system-logs";

describe("SystemLogsViewer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the ungated /logs endpoint, not the operator /debug surface", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          logs: [
            {
              timestamp: "2026-06-16T00:00:00Z",
              level: "INFO",
              scope: "server",
              message: "sidecar started",
            },
          ],
        }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SystemLogsViewer apiUrl="https://api.test" token="tok" />);

    await screen.findByText("sidecar started");

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe("https://api.test/logs");
    expect(String(input)).not.toContain("/debug");
    expect(init).toMatchObject({
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("surfaces an error indicator when the reader responds non-OK", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<SystemLogsViewer apiUrl="https://api.test" token="tok" />);

    await waitFor(() =>
      expect(screen.getByText(/error fetching logs/i)).toBeInTheDocument(),
    );
  });
});
