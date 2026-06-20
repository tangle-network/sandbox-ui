// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantClient, AssistantThreadSummary } from "./client";
import { AssistantClientProvider } from "./client-context";
import { useAssistantThreads } from "./useAssistantThreads";

function thread(id: string): AssistantThreadSummary {
  return { id, title: id, createdAt: "", updatedAt: "" };
}

function setup() {
  const fetchThreads = vi.fn();
  const client: AssistantClient = {
    fetchModels: vi.fn(),
    fetchThreads,
    fetchThreadHistory: vi.fn(),
    streamChat: vi.fn(),
    confirmProposal: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AssistantClientProvider client={client}>{children}</AssistantClientProvider>
  );
  return { fetchThreads, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAssistantThreads", () => {
  it("does not fetch on mount and populates only on refresh", async () => {
    const { fetchThreads, wrapper } = setup();
    fetchThreads.mockResolvedValue([thread("t1")]);
    const { result } = renderHook(() => useAssistantThreads("userA"), {
      wrapper,
    });
    // Lazy by design — no request until the consumer asks for it.
    expect(fetchThreads).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    expect(result.current.loaded).toBe(true);
  });

  it("drops a result that resolves after the user changed", async () => {
    const { fetchThreads, wrapper } = setup();
    let resolveA: (v: AssistantThreadSummary[] | null) => void = () => {};
    fetchThreads.mockReturnValueOnce(
      new Promise<AssistantThreadSummary[] | null>((r) => {
        resolveA = r;
      }),
    );
    const { result, rerender } = renderHook(
      ({ uid }) => useAssistantThreads(uid),
      { initialProps: { uid: "userA" }, wrapper },
    );
    act(() => result.current.refresh());
    // Switch to user B before A's request resolves.
    act(() => rerender({ uid: "userB" }));
    // A's request now resolves — its threads must NOT land under user B.
    await act(async () => {
      resolveA([thread("a-thread")]);
    });
    expect(result.current.threads).toEqual([]);
  });

  it("clears the prior user's threads immediately on a user change", async () => {
    const { fetchThreads, wrapper } = setup();
    fetchThreads.mockResolvedValue([thread("t1")]);
    const { result, rerender } = renderHook(
      ({ uid }) => useAssistantThreads(uid),
      { initialProps: { uid: "userA" }, wrapper },
    );
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    act(() => rerender({ uid: "userB" }));
    expect(result.current.threads).toEqual([]);
    expect(result.current.loaded).toBe(false);
  });
});
