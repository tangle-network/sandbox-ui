/**
 * `@tangle-network/sandbox-ui/assistant` — the in-app assistant/copilot surface,
 * portable across hosts. A host supplies a transport via {@link createAssistantClient}
 * and {@link AssistantClientProvider}; the panel + hooks (added alongside) consume it.
 *
 * This entry currently exposes the transport + the wire/UI contract; the
 * AgentTimeline-based panel, hooks, proposal card, and workflow graph land on
 * top of this foundation.
 */

export * from "./types";
export * from "./client";
export * from "./client-context";
