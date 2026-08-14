import { cn } from "../lib/utils";

/**
 * Visual contract for a rendered mention pill. The TipTap editor extension in
 * `mention-editor.tsx` styles its inline atom node with this, and any other
 * surface that renders a resolved mention (e.g. a sent-message transcript)
 * should use the same constant so the two stay one visual contract instead of
 * silently drifting apart. Kept in its own module (no TipTap import) so
 * importing it never pulls the lazily-loaded editor chunk into a consumer's
 * bundle.
 *
 * @deprecated Mention-pill contract of the legacy AgentComposer mention
 * feature. Use ChatComposer from `@tangle-network/agent-app/web-react` — the
 * canonical composer. AgentComposer is frozen and will be removed at
 * sandbox-ui's next breaking release.
 */
export const MENTION_PILL_CLASS = cn(
  "rounded-md bg-primary/10 px-1 py-0.5 font-medium text-primary",
);
