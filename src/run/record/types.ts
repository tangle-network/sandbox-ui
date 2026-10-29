/** Presentation inputs, not a wire schema. Producers validate retained data before rendering it. */
export interface ConversationNode {
  id: string
  label: string
  parent: string | null
  kind: string
  role?: string
  assignment?: string
  model?: string | null
  servedModel?: string | null
  start?: string
  status?: string
  nativeSessionId?: string
  agentId?: string
  joinBasis?: string
  joinProof?: Record<string, unknown>
  capture?: { status: string }
  [field: string]: unknown
}

export interface ConversationEvent {
  id: string
  node: string
  at: string
  end?: string
  kind: string
  category: string
  label: string
  source?: { path: string; sha256?: string; line?: number; pointer?: string; [field: string]: unknown } | null
  detail: {
    role?: string
    publicText?: string
    publicationNote?: string | null
    contentOmitted?: string
    publicToolCalls?: { id: string; name: string; input?: string; publicationNote?: string | null }[]
    toolCallIds?: string[]
    toolNames?: string[]
    toolCallId?: string
    isError?: boolean
    responseStatus?: string
    recordedClaim?: string
    assessment?: string
    usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; [field: string]: unknown } | null
    reasoning?: string
    reasoningOmitted?: number
    reasoningRedacted?: number
    durationMs?: number
    costListUsd?: number
    clip?: { bytes: number; sha256: string | null }
    [field: string]: unknown
  }
  [field: string]: unknown
}

export interface ConversationRecord {
  runId: string
  nodes: ConversationNode[]
  events: ConversationEvent[]
}
