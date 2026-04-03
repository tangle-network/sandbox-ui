import { useCallback, useMemo, useRef, useState } from "react";
import type { SessionMessage } from "../types/message";
import type { ReasoningPart, SessionPart, TextPart, ToolPart, ToolStatus } from "../types/parts";

export interface SdkSessionAttachment {
  name: string;
  size?: number;
}

export interface SdkSessionSeed {
  id: string;
  role: SessionMessage["role"];
  createdAt?: number | string | Date;
  content?: string;
  attachments?: SdkSessionAttachment[];
  parts?: SessionPart[];
}

export interface SdkSessionEvent {
  type: string;
  data?: Record<string, unknown>;
}

export interface BeginAssistantMessageOptions {
  id?: string;
  role?: Extract<SessionMessage["role"], "assistant" | "system">;
  createdAt?: number | string | Date;
}

export interface AppendUserMessageOptions {
  id?: string;
  role?: Extract<SessionMessage["role"], "user" | "system">;
  content: string;
  createdAt?: number | string | Date;
  attachments?: SdkSessionAttachment[];
}

export interface CompleteAssistantMessageOptions {
  messageId?: string;
  finalText?: string;
}

export interface ApplySdkEventOptions {
  messageId?: string;
}

export interface UseSdkSessionOptions {
  initialMessages?: SdkSessionSeed[];
}

export interface UseSdkSessionReturn {
  messages: SessionMessage[];
  partMap: Record<string, SessionPart[]>;
  isStreaming: boolean;
  activeAssistantMessageId: string | null;
  replaceHistory: (messages: SdkSessionSeed[]) => void;
  appendUserMessage: (message: AppendUserMessageOptions) => string;
  beginAssistantMessage: (options?: BeginAssistantMessageOptions) => string;
  applySdkEvent: (event: SdkSessionEvent, options?: ApplySdkEventOptions) => void;
  completeAssistantMessage: (options?: CompleteAssistantMessageOptions) => void;
  failAssistantMessage: (error: string, options?: { messageId?: string }) => void;
  setStreaming: (value: boolean) => void;
  reset: () => void;
}

interface ConversationState {
  messages: SessionMessage[];
  partMap: Record<string, SessionPart[]>;
}

type GatewayPart = Record<string, unknown>;

function uid(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fall through to the local fallback below.
    }
  }

  return `sdk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toMillis(value: number | string | Date | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();

  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function textPartsFromContent(
  content: string,
  attachments?: SdkSessionAttachment[],
): SessionPart[] {
  const attachmentText = attachments?.length
    ? `\n\nAttachments:\n${attachments
        .map((attachment) => `- ${attachment.name}`)
        .join("\n")}`
    : "";
  const text = `${content}${attachmentText}`.trim();

  return text ? [{ type: "text", text } satisfies TextPart] : [];
}

function normalizeTime(value: unknown): ToolPart["state"]["time"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const start = Number(record.start ?? record.startedAt ?? record.started_at);
  const end = Number(record.end ?? record.completedAt ?? record.completed_at);

  if (!Number.isFinite(start) && !Number.isFinite(end)) {
    return undefined;
  }

  return {
    start: Number.isFinite(start) ? start : undefined,
    end: Number.isFinite(end) ? end : undefined,
  };
}

function normalizeStatus(value: unknown, output: unknown, error: unknown): ToolStatus {
  if (value === "pending" || value === "running" || value === "completed" || value === "error") {
    return value;
  }

  if (typeof error === "string" && error.length > 0) {
    return "error";
  }

  if (output !== undefined) {
    return "completed";
  }

  return "running";
}

function resolveToolIdentity(rawPart: GatewayPart): string {
  return String(
    rawPart.id ??
      rawPart.callID ??
      rawPart.callId ??
      rawPart.toolUseId ??
      rawPart.toolCallId ??
      rawPart.tool ??
      rawPart.name ??
      "tool",
  );
}

function normalizePart(rawPart: GatewayPart): SessionPart | null {
  const type = String(rawPart.type ?? "");

  if (type === "text") {
    return {
      type: "text",
      text: asString(rawPart.text) ?? asString(rawPart.content) ?? "",
    };
  }

  if (type === "reasoning") {
    return {
      type: "reasoning",
      text: asString(rawPart.text) ?? asString(rawPart.content) ?? "",
      time: normalizeTime(rawPart.time),
    } satisfies ReasoningPart;
  }

  if (type === "tool") {
    const stateRecord = asRecord(rawPart.state);
    const input = stateRecord?.input ?? rawPart.input;
    const output = stateRecord?.output ?? rawPart.output;
    const error = stateRecord?.error ?? rawPart.error;

    return {
      type: "tool",
      id: resolveToolIdentity(rawPart),
      tool: String(rawPart.tool ?? rawPart.name ?? "tool"),
      callID:
        rawPart.callID != null || rawPart.callId != null
          ? String(rawPart.callID ?? rawPart.callId)
          : undefined,
      state: {
        status: normalizeStatus(stateRecord?.status ?? rawPart.status, output, error),
        input,
        output,
        error: typeof error === "string" ? error : undefined,
        metadata: asRecord(stateRecord?.metadata) ?? asRecord(rawPart.metadata),
        time: normalizeTime(stateRecord?.time ?? rawPart.time),
      },
    } satisfies ToolPart;
  }

  return null;
}

function getPartKey(rawPart: GatewayPart): string {
  const type = String(rawPart.type ?? "unknown");

  if (type === "tool") {
    return `tool:${resolveToolIdentity(rawPart)}`;
  }

  if (type === "reasoning") {
    return `reasoning:${String(rawPart.id ?? rawPart.partId ?? rawPart.index ?? "current")}`;
  }

  return `text:${String(rawPart.id ?? rawPart.partId ?? rawPart.index ?? "current")}`;
}

function mergePart(existing: SessionPart | undefined, incoming: SessionPart, delta?: string): SessionPart {
  if (!existing) {
    if (incoming.type === "text" && delta) {
      return { type: "text", text: delta };
    }

    return incoming;
  }

  if (existing.type === "text" && incoming.type === "text") {
    return {
      type: "text",
      text: delta ? `${existing.text}${delta}` : incoming.text,
      synthetic: incoming.synthetic ?? existing.synthetic,
    };
  }

  if (existing.type === "reasoning" && incoming.type === "reasoning") {
    return {
      ...existing,
      ...incoming,
      text:
        delta && incoming.text === existing.text
          ? `${existing.text}${delta}`
          : incoming.text || existing.text,
      time: incoming.time ?? existing.time,
    };
  }

  if (existing.type === "tool" && incoming.type === "tool") {
    return {
      ...existing,
      ...incoming,
      state: {
        ...existing.state,
        ...incoming.state,
        time: incoming.state.time ?? existing.state.time,
      },
    };
  }

  return incoming;
}

function mapSeeds(messages: SdkSessionSeed[]): ConversationState {
  return {
    messages: messages.map((message, index) => ({
      id: message.id,
      role: message.role,
      _insertionIndex: index,
      time: {
        created: toMillis(message.createdAt) ?? Date.now(),
      },
    })),
    partMap: Object.fromEntries(
      messages.map((message) => [
        message.id,
        message.parts ?? textPartsFromContent(message.content ?? "", message.attachments),
      ]),
    ),
  };
}

export function useSdkSession({
  initialMessages = [],
}: UseSdkSessionOptions = {}): UseSdkSessionReturn {
  const initialConversation = useMemo(
    () => mapSeeds(initialMessages),
    [initialMessages],
  );
  const [conversation, setConversation] = useState<ConversationState>(initialConversation);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeAssistantIdRef = useRef<string | null>(null);
  const insertionIndexRef = useRef(initialConversation.messages.length);
  const partIndexRef = useRef<Record<string, Record<string, number>>>({});

  const replaceHistory = useCallback((messages: SdkSessionSeed[]) => {
    const next = mapSeeds(messages);
    setConversation(next);
    setIsStreaming(false);
    activeAssistantIdRef.current = null;
    insertionIndexRef.current = next.messages.length;
    partIndexRef.current = {};
  }, []);

  const appendUserMessage = useCallback(
    ({
      id = uid(),
      role = "user",
      content,
      createdAt,
      attachments,
    }: AppendUserMessageOptions) => {
      setConversation((prev) => ({
        messages: [
          ...prev.messages,
          {
            id,
            role,
            _insertionIndex: insertionIndexRef.current++,
            time: {
              created: toMillis(createdAt) ?? Date.now(),
            },
          },
        ],
        partMap: {
          ...prev.partMap,
          [id]: textPartsFromContent(content, attachments),
        },
      }));

      return id;
    },
    [],
  );

  const beginAssistantMessage = useCallback(
    ({
      id = uid(),
      role = "assistant",
      createdAt,
    }: BeginAssistantMessageOptions = {}) => {
      setConversation((prev) => ({
        messages: [
          ...prev.messages,
          {
            id,
            role,
            _insertionIndex: insertionIndexRef.current++,
            time: {
              created: toMillis(createdAt) ?? Date.now(),
            },
          },
        ],
        partMap: {
          ...prev.partMap,
          [id]: prev.partMap[id] ?? [],
        },
      }));

      activeAssistantIdRef.current = id;
      partIndexRef.current[id] = partIndexRef.current[id] ?? {};
      setIsStreaming(true);
      return id;
    },
    [],
  );

  const completeAssistantMessage = useCallback(
    ({ messageId, finalText }: CompleteAssistantMessageOptions = {}) => {
      const targetId = messageId ?? activeAssistantIdRef.current;
      if (!targetId) {
        setIsStreaming(false);
        return;
      }

      if (finalText) {
        setConversation((prev) => {
          const existingParts = prev.partMap[targetId] ?? [];
          const nextParts = [...existingParts];
          const textIndex = nextParts.findIndex((part) => part.type === "text");

          if (textIndex === -1) {
            nextParts.push({ type: "text", text: finalText });
          } else {
            nextParts[textIndex] = { type: "text", text: finalText };
          }

          return {
            ...prev,
            partMap: {
              ...prev.partMap,
              [targetId]: nextParts,
            },
          };
        });
      }

      delete partIndexRef.current[targetId];
      if (activeAssistantIdRef.current === targetId) {
        activeAssistantIdRef.current = null;
      }
      setIsStreaming(false);
    },
    [],
  );

  const failAssistantMessage = useCallback(
    (error: string, options?: { messageId?: string }) => {
      const targetId = options?.messageId ?? activeAssistantIdRef.current;
      if (!targetId) {
        setIsStreaming(false);
        return;
      }

      setConversation((prev) => ({
        ...prev,
        partMap: {
          ...prev.partMap,
          [targetId]: [{ type: "text", text: `Error: ${error}` }],
        },
      }));

      delete partIndexRef.current[targetId];
      if (activeAssistantIdRef.current === targetId) {
        activeAssistantIdRef.current = null;
      }
      setIsStreaming(false);
    },
    [],
  );

  const applySdkEvent = useCallback(
    (event: SdkSessionEvent, options?: ApplySdkEventOptions) => {
      const eventData = asRecord(event.data) ?? {};

      if (event.type === "message.updated") {
        const id =
          asString(eventData.id) ??
          asString(eventData.messageId) ??
          options?.messageId;
        const role = (asString(eventData.role) ?? "assistant") as SessionMessage["role"];

        if (!id) {
          return;
        }

        setConversation((prev) => {
          if (prev.messages.some((message) => message.id === id)) {
            return prev;
          }

          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id,
                role,
                _insertionIndex: insertionIndexRef.current++,
                time: { created: Date.now() },
              },
            ],
            partMap: {
              ...prev.partMap,
              [id]: prev.partMap[id] ?? [],
            },
          };
        });

        if (role === "assistant" || role === "system") {
          activeAssistantIdRef.current = id;
          partIndexRef.current[id] = partIndexRef.current[id] ?? {};
          setIsStreaming(true);
        }
        return;
      }

      if (event.type === "message.part.updated") {
        const rawPart = asRecord(eventData.part) ?? eventData;
        const targetId = options?.messageId ?? activeAssistantIdRef.current;
        const delta = asString(eventData.delta);

        if (!targetId || !rawPart) {
          return;
        }

        const normalizedPart = normalizePart(rawPart);
        if (!normalizedPart) {
          return;
        }

        const key = getPartKey(rawPart);
        setConversation((prev) => {
          const existingParts = prev.partMap[targetId] ?? [];
          const nextParts = [...existingParts];
          const indexMap =
            partIndexRef.current[targetId] ??
            (partIndexRef.current[targetId] = {});
          const existingIndex = indexMap[key];

          if (existingIndex == null) {
            indexMap[key] = nextParts.length;
            nextParts.push(mergePart(undefined, normalizedPart, delta));
          } else {
            nextParts[existingIndex] = mergePart(
              nextParts[existingIndex],
              normalizedPart,
              delta,
            );
          }

          return {
            ...prev,
            partMap: {
              ...prev.partMap,
              [targetId]: nextParts,
            },
          };
        });

        activeAssistantIdRef.current = targetId;
        setIsStreaming(true);
        return;
      }

      if (event.type === "result") {
        completeAssistantMessage({
          messageId: options?.messageId,
          finalText: asString(eventData.finalText),
        });
        return;
      }

      if (event.type === "done") {
        completeAssistantMessage({ messageId: options?.messageId });
        return;
      }

      if (event.type === "error") {
        failAssistantMessage(
          asString(eventData.message) ?? "Agent error",
          { messageId: options?.messageId },
        );
      }
    },
    [completeAssistantMessage, failAssistantMessage],
  );

  const reset = useCallback(() => {
    setConversation({ messages: [], partMap: {} });
    setIsStreaming(false);
    activeAssistantIdRef.current = null;
    insertionIndexRef.current = 0;
    partIndexRef.current = {};
  }, []);

  return {
    messages: conversation.messages,
    partMap: conversation.partMap,
    isStreaming,
    activeAssistantMessageId: activeAssistantIdRef.current,
    replaceHistory,
    appendUserMessage,
    beginAssistantMessage,
    applySdkEvent,
    completeAssistantMessage,
    failAssistantMessage,
    setStreaming: setIsStreaming,
    reset,
  };
}
