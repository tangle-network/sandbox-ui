import { GraphErrorBoundary, retryImport } from "@tangle-network/charts/react/agent-graph/presentation";
export { GraphErrorBoundary, retryImport } from "@tangle-network/charts/react/agent-graph/presentation";
/**
 * Lazy + error-isolated boundary for {@link WorkflowGraph}. React Flow (~50KB)
 * is only needed on the workflow detail page and on workflow proposal cards, so
 * it's code-split out of the always-loaded app shell. The Suspense fallback
 * keeps the caller's height so layout doesn't jump; the error boundary degrades
 * to the raw YAML if the chunk fails
 * to load (offline) or React Flow throws, instead of crashing the panel tree.
 *
 * The chunk import auto-retries a transient failure (a flaky network or an
 * HMR/cache miss) before degrading, and the fallback offers a manual retry that
 * re-attempts the import — so a recoverable failure isn't permanently pinned to
 * the YAML view. A chunk that is gone for good (e.g. an old hash after a deploy)
 * still degrades to the fully-legible YAML; the host can recover those globally
 * via a Vite `vite:preloadError` reload guard.
 */

import { type ComponentType, lazy, Suspense, useState } from "react";
import type { WorkflowGraphProps } from "./WorkflowGraph";

function lazyWorkflowGraph(): ComponentType<WorkflowGraphProps> {
  return lazy(() =>
    retryImport(() =>
      import("./WorkflowGraph").then((m) => ({ default: m.WorkflowGraph })),
    ),
  );
}
// One lazy component for every mount: it resolves once, so a remount renders at
// once instead of suspending into "Loading graph…". A manual retry replaces it,
// because React.lazy caches a rejected import too.
let Impl = lazyWorkflowGraph();

/** Graceful degradation when the graph can't render: the workflow is still
 *  fully legible as YAML, with a retry for a recoverable load failure. */
function GraphFallback({
  yaml,
  className,
  fitHeight,
  onRetry,
}: WorkflowGraphProps & { onRetry: () => void }) {
  return (
    <div
      className={`overflow-auto rounded-lg border border-border bg-background p-2 ${className ?? ""}`}
      style={fitHeight ? { maxHeight: fitHeight } : undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Couldn't render the graph — showing the definition.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-muted-foreground text-xs transition hover:text-foreground"
        >
          Retry
        </button>
      </div>
      <pre className="text-foreground text-xs">
        <code>{yaml}</code>
      </pre>
    </div>
  );
}

export function WorkflowGraph(props: WorkflowGraphProps) {
  // A manual retry re-keys the boundary to clear its error state.
  const [attempt, setAttempt] = useState(0);

  return (
    // Key the boundary by the workflow AND the attempt so a different/edited
    // definition or a manual retry remounts it and re-attempts the graph — a
    // transient chunk/render failure on one workflow doesn't permanently pin the
    // YAML fallback.
    <GraphErrorBoundary
      key={`${props.yaml}::${attempt}`}
      fallback={
        <GraphFallback
          {...props}
          onRetry={() => {
            Impl = lazyWorkflowGraph();
            setAttempt((a) => a + 1);
          }}
        />
      }
    >
      <Suspense
        fallback={
          <div
            className={`flex items-center justify-center rounded-lg border border-border border-dashed text-text-muted text-xs ${props.className ?? ""}`}
            style={props.fitHeight ? { height: props.fitHeight } : undefined}
          >
            Loading graph…
          </div>
        }
      >
        <Impl {...props} />
      </Suspense>
    </GraphErrorBoundary>
  );
}
