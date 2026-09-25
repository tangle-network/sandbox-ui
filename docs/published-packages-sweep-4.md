# Published packages sweep 4

Base audited: `533f08eabd5f1f69fc9213bf52784c0bb6c3f638`.

## Findings

- `src/hooks/use-sidecar-auth.ts` hand-rolls the sidecar challenge/session exchange and persists the resulting bearer token in localStorage.
- `src/hooks/use-session-stream.ts` hand-rolls authenticated session HTTP and SSE parsing with `eventsource-parser`.
- `src/hooks/use-session-crud.ts` hand-rolls the session REST client.
- `src/hooks/use-sandbox-metrics.ts` calls the sidecar proxy directly.
- `src/chat/artifact-agent-dock.tsx` includes an optional fetch + NDJSON transport.

These are transport/auth capabilities, not presentation.

## Replacement boundary

The canonical browser path is the published Sandbox SDK scoped-token/session gateway plus Agent App's resumable-turn/client transports. UI components should receive clients/callbacks and should not mint, cache, or parse platform session credentials themselves.

No vendored package directory was found by the repository code search for `vendor`.

## Follow-up required

Move the hooks above onto the published browser-safe Sandbox/Agent App clients, remove `eventsource-parser` when the last local parser is gone, and keep sandbox-ui transport-free except for explicitly generic consumer callbacks.
