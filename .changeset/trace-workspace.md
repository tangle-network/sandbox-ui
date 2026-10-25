---
"@tangle-network/sandbox-ui": minor
---

`./run` adds `TraceWorkspace`: the agent timeline and span waterfall (`TraceWaterfall`, charts FlowWaterfall with Sandbox UI's brand marks) beside the selected agent's live conversation, streamed from a per-agent Server-Sent Events URL (`streamUrl(agentId)`; rows, reset and end events, reconnecting with `?after=lastSeq`) and rendered with `AgentTimeline` (text merges into the turn, tool calls are rows their results complete, reasoning stays collapsed). The panel follows new output unless the reader scrolled up, then shows a "New output" pill. Scrubbing is time travel: `onTimeChange(t | null)` reports the cursor, events draw as an event track (click or N/P), the conversation shows what had been said by `t`, and the page's `files` and `scoreboard` slots render as of the cursor or say "not time-indexed". `useAgentStream` and `foldAgentRows` are exported for hosts that render the stream elsewhere.
