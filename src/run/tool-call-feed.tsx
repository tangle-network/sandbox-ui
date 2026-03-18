/**
 * ToolCallFeed — interleaves text chunks with tool call activity steps.
 *
 * This is the core Conductor pattern: a unified thread showing
 * [text -> tool_call -> tool_result -> text -> tool_call -> ...].
 *
 * Renders assistant response as a sequence of segments, where each
 * segment is either text (markdown) or a tool call group.
 */

import { type ReactNode } from "react";
import { SimpleMarkdown } from "../markdown/simple-markdown";
import { ToolCallStep, ToolCallGroup, type ToolCallType, type ToolCallStatus } from "./tool-call-step";
import { cn } from "../lib/utils";

export interface ToolCallData {
  id: string;
  type: ToolCallType;
  label: string;
  status: ToolCallStatus;
  detail?: string;
  output?: string;
  duration?: number;
}

export type FeedSegment =
  | { kind: "text"; content: string }
  | { kind: "tool_call"; call: ToolCallData }
  | { kind: "tool_group"; title?: string; calls: ToolCallData[] };

export interface ToolCallFeedProps {
  segments: FeedSegment[];
  className?: string;
}

/**
 * Renders a feed of interleaved text and tool calls.
 */
export function ToolCallFeed({ segments, className }: ToolCallFeedProps) {
  if (segments.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {segments.map((segment, i) => {
        if (segment.kind === "text") {
          return segment.content.trim() ? (
            <SimpleMarkdown key={i} content={segment.content} />
          ) : null;
        }

        if (segment.kind === "tool_call") {
          return (
            <ToolCallStep
              key={segment.call.id || i}
              type={segment.call.type}
              label={segment.call.label}
              status={segment.call.status}
              detail={segment.call.detail}
              output={segment.call.output}
              duration={segment.call.duration}
            />
          );
        }

        if (segment.kind === "tool_group") {
          return (
            <ToolCallGroup key={i} title={segment.title}>
              {segment.calls.map((call) => (
                <ToolCallStep
                  key={call.id}
                  type={call.type}
                  label={call.label}
                  status={call.status}
                  detail={call.detail}
                  output={call.output}
                  duration={call.duration}
                />
              ))}
            </ToolCallGroup>
          );
        }

        return null;
      })}
    </div>
  );
}

/**
 * Parse raw SSE tool events into FeedSegments.
 *
 * This is the bridge between the orchestrator's SSE stream format
 * and the ToolCallFeed component. Consumers call this in their
 * useToolCallStream hook.
 */
export function parseToolEvent(event: {
  type: string;
  data: Record<string, unknown>;
}): ToolCallData | null {
  const { type, data } = event;

  // Map common event types to ToolCallData
  if (type === "tool.invocation" || type === "tool_use") {
    const toolName = (data.name || data.tool || "unknown") as string;
    const input = data.input as Record<string, unknown> | undefined;

    return {
      id: (data.id || data.toolUseId || crypto.randomUUID()) as string,
      type: mapToolName(toolName),
      label: formatToolLabel(toolName, input),
      status: "running",
      detail: input ? formatToolInput(toolName, input) : undefined,
    };
  }

  if (type === "tool.result" || type === "tool_result") {
    return {
      id: (data.id || data.toolUseId || "") as string,
      type: mapToolName((data.name || data.tool || "unknown") as string),
      label: formatToolLabel((data.name || data.tool || "unknown") as string),
      status: data.error ? "error" : "success",
      output: truncate((data.output || data.result || "") as string, 500),
      duration: data.duration as number | undefined,
    };
  }

  return null;
}

// --- Helpers ---

function mapToolName(name: string): ToolCallType {
  const lower = name.toLowerCase();
  if (lower.includes("bash") || lower.includes("terminal") || lower.includes("exec")) return "bash";
  if (lower.includes("read") || lower.includes("cat")) return "read";
  if (lower.includes("write") || lower.includes("create")) return "write";
  if (lower.includes("edit") || lower.includes("replace")) return "edit";
  if (lower.includes("glob") || lower.includes("find")) return "glob";
  if (lower.includes("grep") || lower.includes("search")) return "grep";
  if (lower.includes("list") || lower.includes("ls")) return "list";
  if (lower.includes("inspect")) return "inspect";
  if (lower.includes("audit")) return "audit";
  return "unknown";
}

function formatToolLabel(toolName: string, input?: Record<string, unknown>): string {
  const lower = toolName.toLowerCase();

  if (lower.includes("bash") && input?.command) {
    const cmd = String(input.command);
    return cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
  }
  if ((lower.includes("read") || lower.includes("cat")) && input?.path) {
    return `Read ${input.path}`;
  }
  if (lower.includes("write") && input?.path) {
    return `Write ${input.path}`;
  }
  if (lower.includes("edit") && input?.path) {
    return `Edit ${input.path}`;
  }
  if (lower.includes("glob") && input?.pattern) {
    return `Find ${input.pattern}`;
  }
  if (lower.includes("grep") && input?.pattern) {
    return `Search for ${input.pattern}`;
  }

  return toolName;
}

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  if (input.command) return String(input.command);
  if (input.path) return String(input.path);
  return JSON.stringify(input, null, 2).slice(0, 300);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}
