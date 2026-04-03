import { useCallback, useState } from "react";
import type { Run } from "../types/run";

/**
 * Manages per-run collapse state with auto-collapse after run completion.
 *
 * - Runs stay expanded by default
 * - Collapse is manual only
 */
export function useRunCollapseState(runs: Run[]) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const isCollapsed = useCallback(
    (runId: string): boolean => {
      return collapsedMap[runId] ?? false;
    },
    [collapsedMap],
  );

  const toggleCollapse = useCallback((runId: string) => {
    setCollapsedMap((prev) => ({ ...prev, [runId]: !prev[runId] }));
  }, []);

  return { isCollapsed, toggleCollapse };
}
