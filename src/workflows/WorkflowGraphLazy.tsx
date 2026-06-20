/**
 * Lazy + error-isolated boundary for {@link WorkflowGraph}. React Flow (~50KB)
 * is only needed on the workflow detail page and on workflow proposal cards, so
 * it's code-split out of the always-loaded app shell (the assistant dock lives
 * in `Layout`). The Suspense fallback keeps the caller's height so layout
 * doesn't jump; the error boundary degrades to the raw YAML if the chunk fails
 * to load (offline) or React Flow throws, instead of crashing the panel tree.
 */

import { Component, lazy, type ReactNode, Suspense } from "react";
import type { WorkflowGraphProps } from "./WorkflowGraph";

const WorkflowGraphImpl = lazy(() =>
  import("./WorkflowGraph").then((m) => ({ default: m.WorkflowGraph })),
);

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
 *  fully legible as YAML. */
function GraphFallback({ yaml, className }: WorkflowGraphProps) {
  return (
    <div
      className={`overflow-auto rounded-lg border border-border bg-background p-2 ${className ?? ""}`}
    >
      <p className="mb-1 text-text-muted text-xs">
        Couldn't render the graph — showing the definition.
      </p>
      <pre className="text-text text-xs">
        <code>{yaml}</code>
      </pre>
    </div>
  );
}

export function WorkflowGraph(props: WorkflowGraphProps) {
  return (
    // Key the boundary by the workflow so a different/edited definition remounts
    // it and re-attempts the graph — a transient chunk/render failure on one
    // workflow doesn't permanently pin the YAML fallback for the next.
    <GraphErrorBoundary
      key={props.yaml}
      fallback={<GraphFallback {...props} />}
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
        <WorkflowGraphImpl {...props} />
      </Suspense>
    </GraphErrorBoundary>
  );
}
