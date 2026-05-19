import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useIntegrations } from "./use-integrations";

function mockFetchSequence(
  routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = new URL(url, "http://x").pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${path}`;
    const handler = routes[key] ?? routes[path];
    if (!handler) {
      return new Response(`No mock for ${key}`, { status: 500 });
    }
    return handler(init);
  }) as unknown as typeof fetch;
}

describe("useIntegrations", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "http://localhost/" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("loads catalog + connections on mount when autoLoad is true", async () => {
    const fetchImpl = mockFetchSequence({
      "GET /api/integrations/catalog": () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              catalog: {
                providers: [
                  { providerId: "google", connectors: [{ connectorId: "gmail" }] },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      "GET /api/integrations/connections": () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              connections: [
                {
                  id: "c1",
                  providerId: "google",
                  connectorId: "gmail",
                  status: "connected",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      "GET /api/integrations/healthchecks": () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { healthchecks: [{ connectionId: "c1", status: "ok" }] },
          }),
          { status: 200 },
        ),
    });

    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations/", fetchImpl }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalog).toHaveLength(1);
    expect(result.current.connections).toHaveLength(1);
    expect(result.current.healthByConnectionId.c1?.status).toBe("ok");
    expect(result.current.error).toBeNull();
  });

  it("redirects the browser when connect() succeeds", async () => {
    const fetchImpl = mockFetchSequence({
      "GET /api/integrations/catalog": () =>
        new Response(
          JSON.stringify({ success: true, data: { catalog: { providers: [] } } }),
          { status: 200 },
        ),
      "GET /api/integrations/connections": () =>
        new Response(
          JSON.stringify({ success: true, data: { connections: [] } }),
          { status: 200 },
        ),
      "GET /api/integrations/healthchecks": () =>
        new Response("{}", { status: 200 }),
      "POST /api/integrations/auth/start": (init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.providerId).toBe("google");
        return new Response(
          JSON.stringify({
            success: true,
            data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth?x=1" },
          }),
          { status: 200 },
        );
      },
    });

    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.connect({
        providerId: "google",
        connectorId: "gmail",
        returnUrl: "https://gtm.tangle.tools/integrations",
      });
    });
    expect(window.location.href).toBe("https://accounts.google.com/o/oauth2/auth?x=1");
  });

  it("surfaces an error when /auth/start fails", async () => {
    const fetchImpl = mockFetchSequence({
      "GET /api/integrations/catalog": () =>
        new Response(
          JSON.stringify({ success: true, data: { catalog: { providers: [] } } }),
          { status: 200 },
        ),
      "GET /api/integrations/connections": () =>
        new Response(
          JSON.stringify({ success: true, data: { connections: [] } }),
          { status: 200 },
        ),
      "GET /api/integrations/healthchecks": () =>
        new Response("{}", { status: 200 }),
      "POST /api/integrations/auth/start": () =>
        new Response("forbidden", { status: 403 }),
    });
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.connect({
        providerId: "google",
        connectorId: "gmail",
        returnUrl: "https://gtm.tangle.tools/integrations",
      }),
    ).rejects.toThrow(/Failed to start OAuth \(403\)/);
  });

  it("disconnect() DELETEs by connection id and refreshes", async () => {
    let connectionsCallCount = 0;
    const fetchImpl = mockFetchSequence({
      "GET /api/integrations/catalog": () =>
        new Response(
          JSON.stringify({ success: true, data: { catalog: { providers: [] } } }),
          { status: 200 },
        ),
      "GET /api/integrations/connections": () => {
        connectionsCallCount += 1;
        return new Response(
          JSON.stringify({ success: true, data: { connections: [] } }),
          { status: 200 },
        );
      },
      "GET /api/integrations/healthchecks": () =>
        new Response("{}", { status: 200 }),
      "DELETE /api/integrations/connections/c-99": () =>
        new Response(
          JSON.stringify({ success: true, data: {} }),
          { status: 200 },
        ),
    });

    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const initialCount = connectionsCallCount;

    await act(async () => {
      await result.current.disconnect("c-99");
    });
    await waitFor(() => expect(connectionsCallCount).toBe(initialCount + 1));
  });
});
