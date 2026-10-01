import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const input = {
  providerId: "google",
  connectorId: "gmail",
  returnUrl: "https://app.example/integrations",
  requestedScopes: ["mail.read"],
};

function routes(base = "/api/integrations") {
  return {
    [`GET ${base}/catalog`]: () => json({ providers: [{ providerId: base }] }),
    [`GET ${base}/connections`]: () =>
      json({ connections: [{ id: base, providerId: base, status: "connected" }] }),
    [`GET ${base}/healthchecks`]: () =>
      json({ healthchecks: [{ connectionId: base, status: "ok" }] }),
  };
}

function calls(fetchImpl: typeof fetch, path: string, method = "GET") {
  return vi.mocked(fetchImpl).mock.calls.filter(
    ([url, init]) => String(url) === path && (init?.method ?? "GET") === method,
  );
}

function returnEvents() {
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
}

describe("useIntegrations", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "http://localhost/" },
    });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    for (const [, init] of vi.mocked(fetchImpl).mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(init?.signal?.aborted).toBe(false);
    }
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

  it("keeps autoLoad=false and refreshOnReturn=false opt-outs independent", async () => {
    const fetchImpl = mockFetchSequence(routes());
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl, autoLoad: false }),
    );
    await act(async () => returnEvents());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.catalog[0]?.providerId).toBe("/api/integrations");
    expect(result.current.connections[0]?.id).toBe("/api/integrations");
  });

  it("coalesces same-turn explicit refreshes and can start again after draining", async () => {
    const fetchImpl = mockFetchSequence(routes());
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl, autoLoad: false }),
    );
    await act(async () => {
      await Promise.all(Array.from({ length: 8 }, () => result.current.refresh()));
    });
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(1);
    await act(async () => { await result.current.refresh(); });
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(2);
  });

  it("shares initial, explicit, return and disconnect refreshes with one trailing pass", async () => {
    const first = deferred<Response>();
    const trailing = deferred<Response>();
    let count = 0;
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "GET /api/integrations/catalog": () => ++count === 1 ? first.promise : trailing.promise,
      "DELETE /api/integrations/connections/c%2F99": () => json({}),
    });
    const { result } = renderHook(() => useIntegrations({
      apiBaseUrl: "/api/integrations", fetchImpl, refreshOnReturn: true,
    }));
    await waitFor(() => expect(count).toBe(1));
    let refresh!: Promise<void>;
    let disconnect!: Promise<void>;
    const finished = vi.fn();
    await act(async () => {
      refresh = result.current.refresh().then(finished);
      disconnect = result.current.disconnect("c/99");
      returnEvents();
      void result.current.refresh();
    });
    expect(calls(fetchImpl, "/api/integrations/connections/c%2F99", "DELETE")).toHaveLength(1);
    expect(count).toBe(1);
    await act(async () => { first.resolve(json({ providers: [] })); });
    await waitFor(() => expect(count).toBe(2));
    expect(result.current.isLoading).toBe(true);
    expect(finished).not.toHaveBeenCalled();
    await act(async () => {
      trailing.resolve(json({ providers: [{ providerId: "fresh" }] }));
      await Promise.all([refresh, disconnect]);
    });
    expect(count).toBe(2);
    expect(calls(fetchImpl, "/api/integrations/connections")).toHaveLength(2);
    expect(result.current.catalog[0]?.providerId).toBe("fresh");
    expect(result.current.isLoading).toBe(false);
    expect(finished).toHaveBeenCalledOnce();
  });

  it("recovers a failed pass and reserves only one more pass during the trailing read", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    let count = 0;
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "GET /api/integrations/catalog": () => {
        count += 1;
        if (count === 1) return first.promise;
        if (count === 2) return second.promise;
        return json({ providers: [{ providerId: "latest" }] });
      },
    });
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(count).toBe(1));
    let refresh!: Promise<void>;
    await act(async () => {
      refresh = result.current.refresh();
      first.reject(new Error("offline"));
    });
    await waitFor(() => expect(count).toBe(2));
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      void result.current.refresh();
      void result.current.refresh();
      second.resolve(json({ providers: [] }));
      await refresh;
    });
    expect(count).toBe(3);
    expect(result.current.catalog[0]?.providerId).toBe("latest");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not queue POST or DELETE behind optional healthchecks", async () => {
    const health = deferred<Response>();
    let healthCount = 0;
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "GET /api/integrations/healthchecks": () => ++healthCount === 1 ? health.promise : json({}),
      "POST /api/integrations/auth/start": (init) => {
        expect(init?.credentials).toBe("include");
        expect(init?.headers).toEqual({ "content-type": "application/json" });
        expect(JSON.parse(String(init?.body))).toEqual(input);
        return json({ authorizationUrl: "https://oauth.example/authorize" });
      },
      "DELETE /api/integrations/connections/c%2F99": (init) => {
        expect(init?.credentials).toBe("include");
        return json({});
      },
    });
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(healthCount).toBe(1));
    let disconnect!: Promise<void>;
    await act(async () => {
      disconnect = result.current.disconnect("c/99");
      await result.current.connect(input);
    });
    expect(window.location.href).toBe("https://oauth.example/authorize");
    expect(calls(fetchImpl, "/api/integrations/connections/c%2F99", "DELETE")).toHaveLength(1);
    expect(healthCount).toBe(1);
    await act(async () => {
      health.resolve(json({}));
      await disconnect;
    });
    expect(healthCount).toBe(2);
    expect(result.current.isLoading).toBe(false);
  });

  it.each(["catalog", "connections"])("surfaces %s failure and recovers on refresh", async (endpoint) => {
    let failed = true;
    const fetchImpl = mockFetchSequence({
      ...routes(),
      [`GET /api/integrations/${endpoint}`]: () => failed
        ? new Response("unavailable", { status: 503 }) : json({}),
    });
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toContain(`integration ${endpoint} (503)`);
    failed = false;
    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toBeNull();
  });

  it.each(["http", "network", "body"])("keeps optional health %s errors non-fatal", async (failure) => {
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "GET /api/integrations/healthchecks": () => {
        if (failure === "network") throw new Error("offline");
        return new Response("not json", { status: failure === "http" ? 404 : 200 });
      },
    });
    const { result } = renderHook(() =>
      useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalog).toHaveLength(1);
    expect(result.current.connections).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("keeps rejected mutations and does not refresh after failed DELETE", async () => {
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "DELETE /api/integrations/connections/c": () => new Response("denied", { status: 403 }),
      "POST /api/integrations/auth/start": () => json({}),
    });
    const { result } = renderHook(() => useIntegrations({
      apiBaseUrl: "/api/integrations", fetchImpl, autoLoad: false,
    }));
    await expect(result.current.disconnect("c")).rejects.toThrow("Failed to revoke connection (403): denied");
    await expect(result.current.connect(input)).rejects.toThrow("Platform did not return an authorizationUrl");
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it.each(["response", "json", "error text"])("cancels OAuth awaiting %s even when abort is ignored", async (stage) => {
    const response = deferred<Response>();
    const body = deferred<unknown>();
    const read = vi.fn(() => body.promise);
    const fetchImpl = mockFetchSequence({
      "POST /api/integrations/auth/start": () => {
        if (stage === "response") return response.promise;
        const res = new Response("", { status: stage === "error text" ? 403 : 200 });
        if (stage === "json") vi.spyOn(res, "json").mockImplementation(read);
        else vi.spyOn(res, "text").mockImplementation(() => read().then(String));
        return res;
      },
    });
    const { result, unmount } = renderHook(() => useIntegrations({
      apiBaseUrl: "/api/integrations", fetchImpl, autoLoad: false,
    }));
    const rejected = expect(result.current.connect(input)).rejects.toMatchObject({ name: "AbortError" });
    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledOnce();
      if (stage !== "response") expect(read).toHaveBeenCalledOnce();
    });
    const signal = vi.mocked(fetchImpl).mock.calls[0][1]?.signal;
    unmount();
    await rejected; // Must settle BEFORE the non-cooperative response/body does.
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      response.resolve(json({ authorizationUrl: "https://stale.example" }));
      body.resolve({ authorizationUrl: "https://stale.example" });
    });
    expect(window.location.href).toBe("http://localhost/");
  });

  it.each(["base", "fetcher"])("retires in-flight and retained operations on %s change", async (change) => {
    const oauth = deferred<Response>();
    const deletion = deferred<Response>();
    const fetchImpl = mockFetchSequence({
      ...routes("/a"), ...routes("/b"),
      "POST /a/auth/start": () => oauth.promise,
      "DELETE /a/connections/c": () => deletion.promise,
    });
    const nextFetcher = mockFetchSequence(routes("/a"));
    const initialProps = { apiBaseUrl: "/a", fetchImpl, autoLoad: false };
    const { result, rerender } = renderHook((props) => useIntegrations(props), { initialProps });
    const retired = result.current;
    const connect = expect(retired.connect(input)).rejects.toMatchObject({ name: "AbortError" });
    const disconnect = expect(retired.disconnect("c")).rejects.toMatchObject({ name: "AbortError" });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, ...(change === "base" ? { apiBaseUrl: "/b" } : { fetchImpl: nextFetcher }) });
    await Promise.all([connect, disconnect]);
    // Return to the same identities: an A -> B -> A transition must not revive callbacks.
    rerender(initialProps);
    await expect(retired.connect(input)).rejects.toMatchObject({ name: "AbortError" });
    await expect(retired.disconnect("c")).rejects.toMatchObject({ name: "AbortError" });
    await act(async () => {
      await retired.refresh();
      oauth.resolve(json({ authorizationUrl: "https://stale.example" }));
      deletion.resolve(json({}));
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(nextFetcher).not.toHaveBeenCalled();
    expect(window.location.href).toBe("http://localhost/");
    await act(async () => { await result.current.refresh(); });
    expect(result.current.connections[0]?.id).toBe("/a");
  });

  it.each(["catalog", "connections", "catalog body", "connections body", "healthchecks", "health body"])(
    "ignores retired %s results without clearing a new lifetime's loading state",
    async (stage) => {
      const old = deferred<Response>();
      const oldBody = deferred<unknown>();
      const current = deferred<Response>();
      const endpoint = stage === "health body" ? "healthchecks" : stage.replace(" body", "");
      const read = vi.fn(() => oldBody.promise);
      const fetchImpl = mockFetchSequence({
        ...routes("/old"), ...routes("/new"),
        [`GET /old/${endpoint}`]: () => {
          if (!stage.includes("body")) return old.promise;
          const res = json({});
          vi.spyOn(res, "json").mockImplementation(read);
          return res;
        },
        "GET /new/catalog": () => current.promise,
      });
      const { result, rerender } = renderHook(({ apiBaseUrl }) => useIntegrations({
        apiBaseUrl, fetchImpl,
      }), { initialProps: { apiBaseUrl: "/old" } });
      await waitFor(() => {
        expect(calls(fetchImpl, `/old/${endpoint}`)).toHaveLength(1);
        if (stage.includes("body")) expect(read).toHaveBeenCalledOnce();
      });
      const oldSignal = calls(fetchImpl, `/old/${endpoint}`)[0][1]?.signal;
      rerender({ apiBaseUrl: "/new" });
      await waitFor(() => expect(calls(fetchImpl, "/new/catalog")).toHaveLength(1));
      expect(oldSignal?.aborted).toBe(true);
      const stale = {
        providers: [{ providerId: "stale" }], connections: [{ id: "stale" }],
        healthchecks: [{ connectionId: "stale", status: "failing" }],
      };
      await act(async () => { old.resolve(json(stale)); oldBody.resolve(stale); });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.catalog).toEqual([]);
      expect(result.current.connections).toEqual([]);
      expect(result.current.healthByConnectionId).toEqual({});
      expect(result.current.error).toBeNull();
      await act(async () => { current.resolve(json({ providers: [{ providerId: "new" }] })); });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.catalog[0]?.providerId).toBe("new");
      expect(result.current.connections[0]?.id).toBe("/new");
      expect(result.current.healthByConnectionId).toEqual({ "/new": { connectionId: "/new", status: "ok" } });
    },
  );

  it("does not publish a late required-fetch rejection into a replacement lifetime", async () => {
    const old = deferred<Response>();
    const fetchImpl = mockFetchSequence({
      ...routes("/old"), ...routes("/new"),
      "GET /old/catalog": () => old.promise,
    });
    const { result, rerender } = renderHook(({ apiBaseUrl }) => useIntegrations({
      apiBaseUrl, fetchImpl,
    }), { initialProps: { apiBaseUrl: "/old" } });
    await waitFor(() => expect(calls(fetchImpl, "/old/catalog")).toHaveLength(1));
    rerender({ apiBaseUrl: "/new" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { old.reject(new Error("retired backend failed")); });
    expect(result.current.error).toBeNull();
    expect(result.current.connections[0]?.id).toBe("/new");
  });

  it("cancels a queued refresh and disconnect waiting on health, and consumes late rejection", async () => {
    const health = deferred<Response>();
    const fetchImpl = mockFetchSequence({
      ...routes(),
      "GET /api/integrations/healthchecks": () => health.promise,
      "DELETE /api/integrations/connections/c": () => json({}),
    });
    const { result, unmount } = renderHook(() => useIntegrations({ apiBaseUrl: "/api/integrations", fetchImpl }));
    await waitFor(() => expect(calls(fetchImpl, "/api/integrations/healthchecks")).toHaveLength(1));
    let queued!: Promise<void>;
    let rejected!: Promise<void>;
    await act(async () => {
      queued = result.current.refresh();
      rejected = expect(result.current.disconnect("c")).rejects.toMatchObject({ name: "AbortError" });
    });
    expect(calls(fetchImpl, "/api/integrations/connections/c", "DELETE")).toHaveLength(1);
    unmount();
    await Promise.all([queued, rejected]);
    for (const [, init] of vi.mocked(fetchImpl).mock.calls) expect(init?.signal?.aborted).toBe(true);
    await act(async () => { health.reject(new Error("late offline")); });
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(1);
    await result.current.refresh();
    await expect(result.current.connect(input)).rejects.toMatchObject({ name: "AbortError" });
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(1);
  });

  it("refreshes only visible return events and removes listeners when opted out", async () => {
    const fetchImpl = mockFetchSequence(routes());
    const { result, rerender, unmount } = renderHook(({ refreshOnReturn }) => useIntegrations({
      apiBaseUrl: "/api/integrations", fetchImpl, autoLoad: false, refreshOnReturn,
    }), { initialProps: { refreshOnReturn: true } });
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    await act(async () => returnEvents());
    visibility.mockReturnValue("visible");
    await act(async () => { window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false })); });
    expect(fetchImpl).not.toHaveBeenCalled();
    for (const fire of [
      () => window.dispatchEvent(new Event("focus")),
      () => document.dispatchEvent(new Event("visibilitychange")),
      () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    ]) {
      await act(async () => { fire(); });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    }
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(3);
    rerender({ refreshOnReturn: false });
    await act(async () => returnEvents());
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(3);
    rerender({ refreshOnReturn: true });
    await act(async () => returnEvents());
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(4);
    unmount();
    await act(async () => returnEvents());
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(4);
  });

  it("has one live listener set and a fresh scheduler after Strict Mode replay", async () => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const fetchImpl = mockFetchSequence(routes());
    const replay: string[] = [];
    const { result, unmount } = renderHook(() => {
      const integrations = useIntegrations({
        apiBaseUrl: "/api/integrations", fetchImpl, refreshOnReturn: true,
      });
      React.useEffect(() => {
        replay.push("setup");
        return () => { replay.push("cleanup"); };
      }, []);
      return integrations;
      // RTL wraps the root itself; a wrapper component adds a non-strict parent
      // and React can omit initial passive-effect replay for that subtree.
    }, { reactStrictMode: true });
    expect(replay).toEqual(["setup", "cleanup", "setup"]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The discarded setup's deferred worker must never issue a request.
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(1);
    await act(async () => returnEvents());
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(2);
    for (const [add, remove, type] of [
      [addWindow, removeWindow, "focus"],
      [addWindow, removeWindow, "pageshow"],
      [addDocument, removeDocument, "visibilitychange"],
    ] as const) {
      expect(add.mock.calls.filter(([event]) => event === type)).toHaveLength(2);
      expect(remove.mock.calls.filter(([event]) => event === type)).toHaveLength(1);
    }
    unmount();
    expect(replay).toEqual(["setup", "cleanup", "setup", "cleanup"]);
    for (const [add, remove, type] of [
      [addWindow, removeWindow, "focus"],
      [addWindow, removeWindow, "pageshow"],
      [addDocument, removeDocument, "visibilitychange"],
    ] as const) {
      expect(remove.mock.calls.filter(([event]) => event === type)).toHaveLength(2);
      for (const [event, listener] of add.mock.calls.filter(([event]) => event === type)) {
        expect(remove).toHaveBeenCalledWith(event, listener);
      }
    }
    await act(async () => returnEvents());
    expect(calls(fetchImpl, "/api/integrations/catalog")).toHaveLength(2);
  });
});
