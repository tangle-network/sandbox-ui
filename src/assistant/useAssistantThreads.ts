/**
 * The user's recent assistant chat threads for the history switcher. Unlike the
 * model list (deployment config, fetched once), the thread list changes as the
 * user chats, so it is refetched on demand — the panel calls `refresh()` each
 * time the history view opens, and after a turn settles a new thread into being.
 *
 * The assistant panel is keyed by user id in `AssistantDock`, so this hook
 * remounts (fresh state) on an account switch — one account's threads can never
 * render under another.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantThreadSummary } from "./client";
import { useAssistantClient } from "./client-context";

export interface AssistantThreads {
  threads: AssistantThreadSummary[];
  loading: boolean;
  /** True once a fetch has settled at least once (drives empty-vs-loading copy). */
  loaded: boolean;
  refresh: () => void;
}

export function useAssistantThreads(userId: string | null): AssistantThreads {
  const [threads, setThreads] = useState<AssistantThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;
  // Held in a ref so `refresh`'s identity stays stable (empty deps) while still
  // reaching the current client — the same posture as `userRef` above.
  const client = useAssistantClient();
  const clientRef = useRef(client);
  clientRef.current = client;

  const refresh = useCallback(() => {
    if (!userRef.current) {
      setThreads([]);
      setLoaded(true);
      return;
    }
    // Supersede any in-flight fetch so a rapid re-open can't land a stale list.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    void clientRef.current
      .fetchThreads(ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        // null = transient failure: keep the prior list, just drop the spinner.
        if (result) setThreads(result);
        setLoading(false);
        setLoaded(true);
      })
      .catch(() => {
        // fetchThreads returns null rather than rejecting; this guards a future
        // change (or a throw in a state setter) from leaking an unhandled
        // rejection or wedging the spinner in a perpetual loading state.
        if (!ac.signal.aborted) {
          setLoading(false);
          setLoaded(true);
        }
      });
  }, []);

  // Abort an in-flight fetch on unmount so its `.then` can't set state after the
  // panel has closed.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { threads, loading, loaded, refresh };
}
