"use client"

import { type RefObject, useMemo } from "react"
import { AgentTimeline, AgentTimelineColumn } from "@tangle-network/ui/chat"
import { type AgentStreamOpener, type AgentStreamState, type AgentTranscriptEntry, useAgentStream } from "./agent-stream"
import { timelineItems } from "./record/ConversationRowView"

export const NO_CONVERSATION = "No conversation was recorded for this agent."

export interface AgentConversationOptions {
  /** The reader's cursor on the trace clock, in ms; null while following live or showing the whole run. */
  cursor?: number | null
  /** Epoch ms of the trace's start, when the page knows it. */
  startedAt?: number
  /** The agent's start on the trace clock; with the stream's first message it anchors a cursor the page cannot. */
  agentStartMs?: number
  /** Why this agent has no conversation, when the host knows (no transcript captured, harness without a stream). */
  silent?: string
}

export interface AgentConversation {
  stream: AgentStreamState
  /** The entries said by the cursor; every entry while following live. */
  shown: AgentTranscriptEntry[]
  items: ReturnType<typeof timelineItems>
  /** The stream is open and producing now: an ended, unreachable or scrubbed stream is not. */
  live: boolean
  /** The producer's end frame arrived; a dropped beat is an error while reconnecting, never an ending. */
  ended: boolean
  /** One sentence in place of an empty conversation; undefined while there are words to show. */
  note: string | undefined
  /** The sentence that means no conversation exists, so a host can tell that state from an empty live one. */
  silent: string
}

/** One agent's conversation as of a cursor: its stream, the entries said by then, and the sentence shown when none are. */
export function useAgentConversation(url: string | undefined, openEventSource?: AgentStreamOpener, { cursor = null, startedAt, agentStartMs, silent: why }: AgentConversationOptions = {}): AgentConversation {
  const stream = useAgentStream(url, openEventSource)
  // The run's epoch comes from the page (`startedAt`); without it, the agent's first message anchors its own start.
  const origin = useMemo(() => {
    if (startedAt !== undefined) return startedAt
    const first = stream.entries[0]?.at
    return agentStartMs !== undefined && first !== undefined ? first - agentStartMs : undefined
  }, [startedAt, agentStartMs, stream.entries])
  const shown = cursor === null || origin === undefined ? stream.entries : stream.entries.filter((entry) => entry.at - origin <= cursor)
  const live = stream.alive && !stream.error && cursor === null
  const ended = !stream.alive && !stream.error
  const items = useMemo(() => timelineItems(shown, live), [shown, live])
  const silent = why || NO_CONVERSATION
  // Without words to show, one sentence says why, at the top; never a centred void.
  const note = !url ? silent : cursor !== null && origin === undefined ? "This conversation has no timestamps to replay at the cursor."
    : items.length > 0 || live ? undefined : stream.error ? (ended ? stream.error : `Reconnecting… ${stream.error}`) : ended ? silent : "No messages yet."
  return { stream, shown, items, live, ended, note, silent }
}

/** The conversation's rows, or the one sentence that stands in for them. */
export function AgentConversationView({ conversation, className }: { conversation: AgentConversation; className?: string }) {
  const { items, live, note, stream, ended } = conversation
  if (note === undefined) return <AgentTimelineColumn className={className ?? "max-w-[46rem] p-0"}><AgentTimeline items={items} isThinking={live && items.length === 0} /></AgentTimelineColumn>
  return <p className="m-0 py-1 text-sm text-muted-foreground" data-stream={stream.error ? "reconnecting" : ended ? "ended" : "empty"}>{note}</p>
}

/** The pill that offers the newest output after the reader scrolled up. */
export function NewOutputPill({ unseen, onJump }: { unseen: boolean; onJump: () => void }) {
  if (!unseen) return null
  return <button type="button" onClick={onJump} className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs shadow-sm">New output</button>
}

export type ConversationScroller = RefObject<HTMLDivElement | null>
