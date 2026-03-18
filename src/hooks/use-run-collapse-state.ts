import { useCallback, useEffect, useRef, useState } from "react";
import type { Run } from "../types/run";

const AUTO_COLLAPSE_DELAY = 1000;

/**
 * Manages per-run collapse state with auto-collapse after run completion.
 *
 * - Runs start expanded while streaming
 * - Auto-collapse 1s after the run completes
 * - Manual toggle is preserved (user override sticks)
 */
export function useRunCollapseState(runs: Run[]) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const userOverrides = useRef(new Set<string>());
  const completedRuns = useRef(new Set<string>());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const run of runs) {
      if (run.isComplete && !completedRuns.current.has(run.id)) {
        completedRuns.current.add(run.id);

        if (userOverrides.current.has(run.id)) continue;

        const timer = setTimeout(() => {
          setCollapsedMap((prev) => ({ ...prev, [run.id]: true }));
        }, AUTO_COLLAPSE_DELAY);
        timers.push(timer);
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [runs]);

  const isCollapsed = useCallback(
    (runId: string): boolean => {
      return collapsedMap[runId] ?? false;
    },
    [collapsedMap],
  );

  const toggleCollapse = useCallback((runId: string) => {
    userOverrides.current.add(runId);
    setCollapsedMap((prev) => ({ ...prev, [runId]: !prev[runId] }));
  }, []);

  return { isCollapsed, toggleCollapse };
}
