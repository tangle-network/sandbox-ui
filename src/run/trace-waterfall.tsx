import type { ReactNode } from "react";
import { FlowWaterfall, type FlowWaterfallProps } from "@tangle-network/charts/react";
import type { FlowSpan } from "@tangle-network/charts";
import { ProviderIcon } from "../integrations/provider-logo";
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand";

/** Agent and model spans show their lab/host mark; tool spans show their provider's mark. Unknown keeps the kind glyph. */
export function traceSpanMark(span: FlowSpan): ReactNode {
  if (span.kind === "pipeline" || span.kind === "model") {
    const identity = span.detail ? modelBrandFor(span.detail) : null;
    return identity ? <ModelBrandStack identity={identity} size="sm" /> : undefined;
  }
  const provider = span.icon ?? (span.kind === "tool" ? span.detail : undefined);
  return provider ? <ProviderIcon id={provider} displayName={provider} size={14} className="rounded-[3px]" /> : undefined;
}

export type TraceWaterfallProps = FlowWaterfallProps;

/**
 * The run inspector: the agent timeline (`defaultView="agents"`) and the span waterfall over one clock, from
 * `@tangle-network/charts`, with Sandbox UI's brand marks. Feed it `otlpFlowTrace(spans)` from the
 * `traces convert` contract. Import `@tangle-network/charts/react/flow-waterfall.css` once.
 */
export function TraceWaterfall({ renderIcon = traceSpanMark, ...props }: TraceWaterfallProps) {
  return <FlowWaterfall renderIcon={renderIcon} {...props} />;
}
