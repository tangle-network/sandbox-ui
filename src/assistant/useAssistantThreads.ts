/**
 * The user's recent assistant chat threads for the history switcher. Unlike the
 * model list (deployment config, fetched once), the thread list changes as the
 * user chats, so it is fetched ON DEMAND — call `refresh()` to (re)load it; the
 * panel does so when the history view opens and after a turn settles a new
 * thread into being. It does NOT fetch on mount, so `threads` stays empty and
 * `loaded` false until the first `refresh()`.
 *
 * Self-protective across account AND transport swaps: a `userId` or `client`
 * change immediately clears the list and aborts any in-flight fetch, and a late
 * result is dropped if either the user or the client changed while it was in
 * flight — so one account's (or one transport's) threads can never render under
 * another, regardless of whether the host remounts the hook.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantThreadSummary } from "./client";
import { useAssistantClient } from "./client-context";

export interface AssistantThreads {
  threads: AssistantThreadSummary[];
  loading: boolean;
  /** True once a fetch has settled at least once (drives empty-vs-loading copy). */
  loaded: boolean;
  /** Load (or reload) the thread list. Must be called to populate `threads` —
   *  the hook never fetches on mount (the panel calls this when history opens). */
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
    // Capture the user AND client this fetch is FOR; a result that resolves after
    // either changed must not commit (it would show one account's/transport's
    // threads under another).
    const requestedUserId = userRef.current;
    const requestedClient = clientRef.current;
    if (!requestedUserId) {
      setThreads([]);
      setLoaded(true);
      return;
    }
    // Supersede any in-flight fetch so a rapid re-open can't land a stale list.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    const isCurrent = () =>
      !ac.signal.aborted &&
      userRef.current === requestedUserId &&
      clientRef.current === requestedClient;
    void requestedClient
      .fetchThreads(ac.signal)
      .then((result) => {
        if (!isCurrent()) return;
        // null = transient failure: keep the prior list, just drop the spinner.
        if (result) setThreads(result);
        setLoading(false);
        setLoaded(true);
      })
      .catch(() => {
        // fetchThreads returns null rather than rejecting; this guards a future
        // change (or a throw in a state setter) from leaking an unhandled
        // rejection or wedging the spinner in a perpetual loading state.
        if (isCurrent()) {
          setLoading(false);
          setLoaded(true);
        }
      });
  }, []);

  // Reset on an account OR transport swap: clear the prior list and abort any
  // in-flight fetch the moment `userId` or `client` changes, so the hook stays
  // safe even if the host keeps it mounted across those changes.
  useEffect(() => {
    abortRef.current?.abort();
    setThreads([]);
    setLoading(false);
    setLoaded(false);
  }, [userId, client]);

  // Abort an in-flight fetch on unmount so its `.then` can't set state after the
  // panel has closed.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { threads, loading, loaded, refresh };
}
