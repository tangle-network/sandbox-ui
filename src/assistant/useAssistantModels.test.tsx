// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssistantClient,
  AssistantModelsResult,
} from "./client";

const OK_NONEMPTY: AssistantModelsResult = {
  ok: true,
  data: {
    default: "anthropic/m",
    models: [{ slug: "anthropic/m", label: "M" }],
  },
};
const OK_EMPTY: AssistantModelsResult = {
  ok: true,
  data: { default: "anthropic/m", models: [] },
};
const FAILED: AssistantModelsResult = {
  ok: false,
  data: { default: null, models: [] },
};

// The hook caches the model list in module-level singletons (cache + inflight),
// so each test resets the module graph to start from a clean cache. The provider
// and the hook MUST come from the same post-reset module instance so they share
// one React context — otherwise `useAssistantClient` can't see the provider.
async function load() {
  const { AssistantClientProvider } = await import(
    "./client-context"
  );
  const { useAssistantModels } = await import("./useAssistantModels");
  const fetchModels = vi.fn();
  // Only `fetchModels` is exercised here; the rest satisfy the interface.
  const client: AssistantClient = {
    fetchModels,
    fetchThreads: vi.fn(),
    fetchThreadHistory: vi.fn(),
    streamChat: vi.fn(),
    confirmProposal: vi.fn(),
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AssistantClientProvider client={client}>
      {children}
    </AssistantClientProvider>
  );
  return { useAssistantModels, fetchModels, wrapper };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAssistantModels", () => {
  it("fetches once and serves later mounts from the module cache", async () => {
    const { useAssistantModels, fetchModels, wrapper } = await load();
    fetchModels.mockResolvedValue(OK_NONEMPTY);

    const first = renderHook(() => useAssistantModels(), { wrapper });
    await waitFor(() => expect(first.result.current.models).toHaveLength(1));
    expect(fetchModels).toHaveBeenCalledTimes(1);

    // A second mount reads the cache synchronously — no second fetch.
    const second = renderHook(() => useAssistantModels(), { wrapper });
    expect(second.result.current.models).toHaveLength(1);
    expect(fetchModels).toHaveBeenCalledTimes(1);
  });

  it("does not cache a FAILED fetch — the next mount retries", async () => {
    const { useAssistantModels, fetchModels, wrapper } = await load();
    fetchModels
      .mockResolvedValueOnce(FAILED)
      .mockResolvedValueOnce(OK_NONEMPTY);

    const first = renderHook(() => useAssistantModels(), { wrapper });
    await waitFor(() => expect(fetchModels).toHaveBeenCalledTimes(1));
    expect(first.result.current.models).toHaveLength(0);
    first.unmount();

    // The failure wasn't cached, so the next mount fetches again — and succeeds.
    const second = renderHook(() => useAssistantModels(), { wrapper });
    await waitFor(() => expect(second.result.current.models).toHaveLength(1));
    expect(fetchModels).toHaveBeenCalledTimes(2);
  });

  it("caches a SUCCESSFUL but empty list — no refetch (single-model deploy)", async () => {
    const { useAssistantModels, fetchModels, wrapper } = await load();
    fetchModels.mockResolvedValue(OK_EMPTY);

    const first = renderHook(() => useAssistantModels(), { wrapper });
    await waitFor(() => expect(fetchModels).toHaveBeenCalledTimes(1));
    expect(first.result.current.models).toHaveLength(0);
    first.unmount();

    // A successful (if empty) response is cached, so a later mount does NOT
    // re-fetch — it isn't treated like a failure.
    const second = renderHook(() => useAssistantModels(), { wrapper });
    expect(second.result.current.models).toHaveLength(0);
    expect(fetchModels).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent in-flight fetches across simultaneous mounts", async () => {
    const { useAssistantModels, fetchModels, wrapper } = await load();
    let resolve: (v: AssistantModelsResult) => void = () => {};
    fetchModels.mockReturnValue(
      new Promise<AssistantModelsResult>((r) => {
        resolve = r;
      }),
    );

    // Two mounts before the fetch resolves → one shared in-flight fetch.
    const a = renderHook(() => useAssistantModels(), { wrapper });
    const b = renderHook(() => useAssistantModels(), { wrapper });
    expect(fetchModels).toHaveBeenCalledTimes(1);

    resolve(OK_NONEMPTY);
    await waitFor(() => expect(a.result.current.models).toHaveLength(1));
    expect(b.result.current.models).toHaveLength(1);
    expect(fetchModels).toHaveBeenCalledTimes(1);
  });

  it("does not update state after unmount (clean teardown mid-fetch)", async () => {
    const { useAssistantModels, fetchModels, wrapper } = await load();
    let resolve: (v: AssistantModelsResult) => void = () => {};
    fetchModels.mockReturnValue(
      new Promise<AssistantModelsResult>((r) => {
        resolve = r;
      }),
    );
    const errs: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((e) => {
      errs.push(e);
    });

    const { unmount } = renderHook(() => useAssistantModels(), { wrapper });
    unmount();
    resolve(OK_NONEMPTY);
    await Promise.resolve();
    // No act()/state-update-after-unmount warning was emitted.
    expect(errs).toHaveLength(0);
    spy.mockRestore();
  });
});
