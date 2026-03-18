/**
 * useToolCallStream — parses SSE events into ToolCallFeed segments.
 *
 * Takes raw SSE event data from the orchestrator stream and produces
 * structured FeedSegments that ToolCallFeed can render.
 */

import { useState, useCallback, useRef } from "react";
import type { FeedSegment, ToolCallData } from "../run/tool-call-feed";
import { parseToolEvent } from "../run/tool-call-feed";

export interface UseToolCallStreamReturn {
  /** Current feed segments (text + tool calls interleaved) */
  segments: FeedSegment[];
  /** Push a raw SSE event into the stream */
  pushEvent: (event: { type: string; data: Record<string, unknown> }) => void;
  /** Push a text delta (from message.part.updated) */
  pushText: (delta: string) => void;
  /** Mark a tool call as complete */
  completeToolCall: (id: string, result: { output?: string; error?: string; duration?: number }) => void;
  /** Reset the stream */
  reset: () => void;
}

export function useToolCallStream(): UseToolCallStreamReturn {
  const [segments, setSegments] = useState<FeedSegment[]>([]);
  const pendingToolsRef = useRef<Map<string, ToolCallData>>(new Map());
  const lastSegmentKindRef = useRef<"text" | "tool" | null>(null);

  const pushText = useCallback((delta: string) => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === "text") {
        // Append to existing text segment
        return [...prev.slice(0, -1), { kind: "text", content: last.content + delta }];
      }
      // New text segment
      return [...prev, { kind: "text", content: delta }];
    });
    lastSegmentKindRef.current = "text";
  }, []);

  const pushEvent = useCallback((event: { type: string; data: Record<string, unknown> }) => {
    const toolCall = parseToolEvent(event);
    if (!toolCall) return;

    if (event.type === "tool.invocation" || event.type === "tool_use") {
      // Store pending tool call
      pendingToolsRef.current.set(toolCall.id, toolCall);

      setSegments((prev) => [
        ...prev,
        { kind: "tool_call", call: { ...toolCall, status: "running" } },
      ]);
      lastSegmentKindRef.current = "tool";
    }
  }, []);

  const completeToolCall = useCallback(
    (id: string, result: { output?: string; error?: string; duration?: number }) => {
      const pending = pendingToolsRef.current.get(id);
      if (pending) {
        pending.status = result.error ? "error" : "success";
        pending.output = result.output || result.error;
        pending.duration = result.duration;
        pendingToolsRef.current.delete(id);
      }

      setSegments((prev) =>
        prev.map((seg) => {
          if (seg.kind === "tool_call" && seg.call.id === id) {
            return {
              kind: "tool_call",
              call: {
                ...seg.call,
                status: result.error ? "error" : "success",
                output: result.output || result.error,
                duration: result.duration,
              },
            };
          }
          return seg;
        }),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    setSegments([]);
    pendingToolsRef.current.clear();
    lastSegmentKindRef.current = null;
  }, []);

  return { segments, pushEvent, pushText, completeToolCall, reset };
}
