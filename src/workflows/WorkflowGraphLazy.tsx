/**
 * Lazy + error-isolated boundary for {@link WorkflowGraph}. React Flow (~50KB)
 * is only needed on the workflow detail page and on workflow proposal cards, so
 * it's code-split out of the always-loaded app shell (the assistant dock lives
 * in `Layout`). The Suspense fallback keeps the caller's height so layout
 * doesn't jump; the error boundary degrades to the raw YAML if the chunk fails
 * to load (offline) or React Flow throws, instead of crashing the panel tree.
 *
 * The chunk import auto-retries a transient failure (a flaky network or an
 * HMR/cache miss) before degrading, and the fallback offers a manual retry that
 * re-attempts the import — so a recoverable failure isn't permanently pinned to
 * the YAML view. A chunk that is gone for good (e.g. an old hash after a deploy)
 * still degrades to the fully-legible YAML; the host can recover those globally
 * via a Vite `vite:preloadError` reload guard.
 */

import {
  Component,
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
} from "react";
import type { WorkflowGraphProps } from "./WorkflowGraph";

/** Re-run `factory` up to `retries` times with a short backoff before giving up.
 *  Covers a transient dynamic-import rejection (network blip, a chunk briefly
 *  unavailable behind a CDN) without bothering the user. Exported for tests. */
export function retryImport<T>(
  factory: () => Promise<T>,
  retries = 2,
  delayMs = 350,
): Promise<T> {
  return factory().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<T>((resolve, reject) => {
      setTimeout(
        () => retryImport(factory, retries - 1, delayMs).then(resolve, reject),
        delayMs,
      );
    });
  });
}

function lazyWorkflowGraph(): ComponentType<WorkflowGraphProps> {
  return lazy(() =>
    retryImport(() =>
      import("./WorkflowGraph").then((m) => ({ default: m.WorkflowGraph })),
    ),
  );
}

class GraphErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Graceful degradation when the graph can't render: the workflow is still
 *  fully legible as YAML, with a retry for a recoverable load failure. */
function GraphFallback({
  yaml,
  className,
  onRetry,
}: WorkflowGraphProps & { onRetry: () => void }) {
  return (
    <div
      className={`overflow-auto rounded-lg border border-border bg-background p-2 ${className ?? ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-text-muted text-xs">
          Couldn't render the graph — showing the definition.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-text-muted text-xs transition hover:text-text"
        >
          Retry
        </button>
      </div>
      <pre className="text-text text-xs">
        <code>{yaml}</code>
      </pre>
    </div>
  );
}

export function WorkflowGraph(props: WorkflowGraphProps) {
  // A manual retry bumps `attempt`, which both recreates the lazy component
  // (React.lazy permanently caches a rejected import, so a fresh one is needed
  // to re-run it) and re-keys the boundary to clear its error state.
  const [attempt, setAttempt] = useState(0);
  // A fresh lazy() per attempt is intentional: it re-runs the import after a
  // failure (React.lazy caches a rejected import, so the prior one can't recover).
  const Impl = useMemo(() => lazyWorkflowGraph(), [attempt]);

  return (
    // Key the boundary by the workflow AND the attempt so a different/edited
    // definition or a manual retry remounts it and re-attempts the graph — a
    // transient chunk/render failure on one workflow doesn't permanently pin the
    // YAML fallback.
    <GraphErrorBoundary
      key={`${props.yaml}::${attempt}`}
      fallback={
        <GraphFallback {...props} onRetry={() => setAttempt((a) => a + 1)} />
      }
    >
      <Suspense
        fallback={
          <div
            className={`flex items-center justify-center rounded-lg border border-border border-dashed text-text-muted text-xs ${props.className ?? ""}`}
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
