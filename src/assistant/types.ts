/**
 * Wire + UI types for the in-app assistant panel. The wire shapes mirror the
 * SSE contract emitted by `POST /v1/assistant/chat` (platform-api
 * `routes/assistant.ts`). Drift here only mis-renders the client; the server
 * is the source of truth for what it accepts and emits.
 */

/** Request body for `POST /api/v1/assistant/chat`. */
export interface ChatRequest {
  message: string;
  /** Model slug to run this turn against; omit to use the server default. */
  model?: string;
  /** Omit to start a new thread; pass to continue an existing one. */
  threadId?: string;
  /** Per-turn idempotency key — guards against double-charge on retry. */
  turnKey?: string;
}

// --- Server SSE event payloads (one per `event:` name) ----------------------

export interface ThreadEventData {
  threadId: string;
  turnId: string;
  /** The model slug this turn ran against, when the server reports it. */
  model?: string | null;
}

export interface DeltaEventData {
  text: string;
}

/** Emitted when a read-only tool STARTS running, before its result. Lets the
 *  panel show live "running <tool>…" progress instead of a silent gap. */
export interface ToolCallEventData {
  callId: string;
  name: string;
}

export interface ToolResultEventData {
  callId: string;
  name: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
}

/** What kind of connection a requirement names — drives the card's label and
 *  connect target. "integration" is an OAuth/api-key connection on the
 *  integrations page; "github_app" is the GitHub App installed on the repo (the
 *  event source for a GitHub trigger), connected via the App install flow. */
export type ConnectionRequirementKind = "integration" | "github_app";

/** A connection a proposed workflow references, and whether the user has it
 *  connected right now. Surfaced on an authoring proposal so the card can show
 *  what must be connected — and WHERE — before the workflow can be created. */
export interface ConnectionRequirement {
  provider: string;
  connected: boolean;
  /** What must be connected. Absent on proposals predating the field — treated
   *  as "integration" by the card. */
  kind?: ConnectionRequirementKind;
  /** Where the user connects this requirement, supplied by the server (the
   *  GitHub App install URL is deploy config the client can't derive). Null when
   *  there's no link to offer (e.g. a github_app requirement on a deploy with no
   *  app slug); the card then shows the requirement without a connect link. */
  connectUrl?: string | null;
}

export interface ToolProposalEventData {
  /** Null only if the server has no proposal store wired (tools then unusable). */
  proposalId: string | null;
  callId: string;
  name: string;
  args: unknown;
  /** Present on a workflow-authoring proposal: the integrations it references
   *  and their current connection status. Omitted for non-authoring tools. */
  requirements?: ConnectionRequirement[];
}

export interface UsageEventData {
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  balanceUsd: number | null;
  /** True when a completed turn was replayed from storage (no charge). */
  replayed?: boolean;
}

export interface DoneEventData {
  turnId: string;
  status: string;
  /** True when a mutating tool was proposed and is awaiting confirmation. */
  proposed?: boolean;
  /** True when the agentic loop hit its tool-round cap. */
  capped?: boolean;
}

export interface ErrorEventData {
  code: string;
  message: string;
}

/** Discriminated union the stream reader hands to the reducer. */
export type AssistantStreamEvent =
  | { type: "thread"; data: ThreadEventData }
  | { type: "delta"; data: DeltaEventData }
  | { type: "tool_call"; data: ToolCallEventData }
  | { type: "tool_result"; data: ToolResultEventData }
  | { type: "tool_proposal"; data: ToolProposalEventData }
  | { type: "usage"; data: UsageEventData }
  | { type: "done"; data: DoneEventData }
  | { type: "error"; data: ErrorEventData };

// --- UI model ---------------------------------------------------------------

/** A `tool` message is the inline activity chip for a read-only tool the agent
 *  ran during a turn (e.g. "Validating workflow… ✓"). */
export type ChatRole = "user" | "assistant" | "status" | "tool";

/** Live status of a tool-activity chip. */
export type ToolActivityStatus = "running" | "ok" | "failed";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Present only on `tool` messages — the activity's tool name and state. */
  tool?: { name: string; status: ToolActivityStatus };
}

/** A mutating action the assistant proposed, awaiting the user's confirmation. */
export interface PendingProposal {
  proposalId: string | null;
  callId: string;
  name: string;
  args: unknown;
  /** Integration requirements for a workflow-authoring proposal (each provider
   *  + whether it's connected); omitted for non-authoring proposals. */
  requirements?: ConnectionRequirement[];
  /** Inline error shown ON the card after a RETRYABLE confirm failure (an
   *  unconnected integration): the card stays so the user can connect and
   *  confirm again. Null/absent when the card has not failed a retry. */
  retryError?: string | null;
}

export interface UsageInfo {
  costUsd: number | null;
  balanceUsd: number | null;
  replayed: boolean;
}
