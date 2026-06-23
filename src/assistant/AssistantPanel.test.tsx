// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AssistantPanel } from "./AssistantPanel";
import {
  type AssistantClient,
  type AssistantThreadSummary,
  createAssistantClient,
} from "./client";
import { AssistantClientProvider } from "./client-context";
import { type AssistantState, initialAssistantState } from "./reducer";
import type { AssistantTranscriptView, PendingProposal } from "./types";
import type { AssistantChat } from "./useAssistantChat";

const client = createAssistantClient({ baseUrl: "/api/v1/assistant" });

const proposal: PendingProposal = {
  proposalId: "p1",
  callId: "c1",
  name: "create_workflow",
  args: { yaml: "name: demo" },
};

/** A minimal AssistantChat over a controlled state slice — the panel reads the
 *  state and the bound confirm/cancel handlers; the transport is never hit. */
function makeChat(over: Partial<AssistantState> = {}): AssistantChat {
  return {
    state: { ...initialAssistantState(), ownerId: "u1", ...over },
    confirmingIds: new Set<string>(),
    selectedModel: null,
    setModel: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    confirm: vi.fn(async () => {}),
    cancel: vi.fn(),
    reset: vi.fn(),
    switchThread: vi.fn(),
    restoring: false,
  };
}

function renderPanel(
  chat: AssistantChat,
  renderTranscript?: (view: AssistantTranscriptView) => ReactNode,
) {
  return render(
    <AssistantClientProvider client={client}>
      <AssistantPanel
        chat={chat}
        userId="u1"
        onClose={() => {}}
        renderTranscript={renderTranscript}
      />
    </AssistantClientProvider>,
  );
}

describe("AssistantPanel transcript seam", () => {
  it("renders the built-in AgentTimeline (empty state) when no renderTranscript is supplied", () => {
    renderPanel(makeChat());
    expect(
      screen.getByText(/Ask me to create a workflow/i),
    ).toBeTruthy();
  });

  it("hands the host renderTranscript the live view and a bound renderProposal that renders the ProposalCard", () => {
    let captured: AssistantTranscriptView | null = null;
    const chat = makeChat({
      status: "awaiting_confirm",
      model: "anthropic/claude",
      messages: [{ id: "a", role: "assistant", text: "I'll create that." }],
      pendingProposals: [proposal],
    });

    renderPanel(chat, (view) => {
      captured = view;
      return (
        <div data-testid="host-transcript">
          {view.pendingProposals.map((p) => (
            <div key={p.callId}>{view.renderProposal(p)}</div>
          ))}
        </div>
      );
    });

    // The host renderer ran instead of the built-in timeline.
    expect(screen.getByTestId("host-transcript")).toBeTruthy();
    expect(screen.queryByText(/Ask me to create a workflow/i)).toBeNull();

    // The view carries the panel-derived surface the contract promises.
    expect(captured).not.toBeNull();
    const view = captured as unknown as AssistantTranscriptView;
    expect(view.isStreaming).toBe(false);
    expect(view.isThinking).toBe(false);
    expect(view.model).toBe("anthropic/claude");
    expect(view.messages).toHaveLength(1);
    expect(view.pendingProposals).toHaveLength(1);
    expect(view.pendingProposals[0].callId).toBe("c1");

    // The bound renderProposal renders the panel's own ProposalCard, with the
    // confirm/cancel controls wired — so a host can't accidentally hide a
    // pending mutating action.
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("reflects a live streaming turn in the view's isStreaming/isThinking flags", () => {
    let captured: AssistantTranscriptView | null = null;
    // A turn that has started but emitted no answer text yet reads as thinking.
    const chat = makeChat({
      status: "streaming",
      streamingId: "a",
      messages: [{ id: "a", role: "assistant", text: "" }],
    });

    renderPanel(chat, (view) => {
      captured = view;
      return <div data-testid="host-transcript" />;
    });

    const view = captured as unknown as AssistantTranscriptView;
    expect(view.isStreaming).toBe(true);
    expect(view.isThinking).toBe(true);
  });
});

function thread(id: string): AssistantThreadSummary {
  return { id, title: id, createdAt: "", updatedAt: "" };
}

/** A client whose thread list + delete behavior are controlled; everything else
 *  is the real same-origin client (its background fetches fail harmlessly). */
function deleteClient(
  threads: AssistantThreadSummary[],
  deleteThread?: (id: string) => Promise<{ ok: boolean }>,
): AssistantClient {
  return {
    ...createAssistantClient({ baseUrl: "/api/v1/assistant" }),
    fetchThreads: vi.fn(async () => threads),
    deleteThread,
  };
}

function renderWith(chat: AssistantChat, client: AssistantClient) {
  return render(
    <AssistantClientProvider client={client}>
      <AssistantPanel chat={chat} userId="u1" onClose={() => {}} />
    </AssistantClientProvider>,
  );
}

async function openHistory(awaitTitle: string) {
  fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
  await screen.findByText(awaitTitle);
}

describe("AssistantPanel thread deletion", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes an inactive thread without resetting the live conversation", async () => {
    const del = vi.fn(async () => ({ ok: true }));
    const chat = makeChat({ threadId: "t1", status: "idle" });
    renderWith(chat, deleteClient([thread("t1"), thread("t2")], del));
    await openHistory("t2");
    // [0] is t1 (active), [1] is t2 (inactive).
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete conversation" })[1],
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith("t2"));
    expect(chat.reset).not.toHaveBeenCalled();
  });

  it("resets the live conversation only after deleting the active thread succeeds", async () => {
    const del = vi.fn(async () => ({ ok: true }));
    const chat = makeChat({ threadId: "t1", status: "idle" });
    renderWith(chat, deleteClient([thread("t1")], del));
    await openHistory("t1");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    await waitFor(() => expect(chat.reset).toHaveBeenCalled());
    expect(del).toHaveBeenCalledWith("t1");
  });

  it("does not reset the live conversation when deleting the active thread fails", async () => {
    const del = vi.fn(async () => ({ ok: false }));
    const chat = makeChat({ threadId: "t1", status: "idle" });
    renderWith(chat, deleteClient([thread("t1")], del));
    await openHistory("t1");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith("t1"));
    expect(chat.reset).not.toHaveBeenCalled();
  });

  it("disables deleting the active thread while it is streaming", async () => {
    const chat = makeChat({
      threadId: "t1",
      status: "streaming",
      streamingId: "x",
      messages: [{ id: "x", role: "assistant", text: "" }],
    });
    renderWith(chat, deleteClient([thread("t1")], vi.fn()));
    await openHistory("t1");
    const btn = screen.getByRole("button", {
      name: "Delete conversation",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("hides the delete control when the client has no deleteThread", async () => {
    const chat = makeChat({ threadId: "t1", status: "idle" });
    renderWith(chat, deleteClient([thread("t1")], undefined));
    await openHistory("t1");
    expect(
      screen.queryByRole("button", { name: "Delete conversation" }),
    ).toBeNull();
  });

  it("does not reset when the active thread became busy while the delete was in flight", async () => {
    let resolveDelete: (v: { ok: boolean }) => void = () => {};
    const del = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((r) => {
          resolveDelete = r;
        }),
    );
    const chat = makeChat({ threadId: "t1", status: "idle" });
    renderWith(chat, deleteClient([thread("t1")], del));
    await openHistory("t1");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );
    await waitFor(() => expect(del).toHaveBeenCalled());
    // The user starts a turn on the active thread while the delete is in flight.
    chat.state.status = "streaming";
    await act(async () => {
      resolveDelete({ ok: true });
    });
    expect(chat.reset).not.toHaveBeenCalled();
  });
});
