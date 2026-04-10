import { memo, type ReactNode } from "react";
import type { GroupedMessage } from "../types/run";
import type { SessionPart } from "../types/parts";
import type { SessionMessage } from "../types/message";
import type { AgentBranding } from "../types/branding";
import type { CustomToolRenderer } from "../types/tool-display";
import type { ToolPart } from "../types/parts";
import { RunGroup } from "../run/run-group";
import { UserMessage } from "./user-message";

export interface MessageListProps {
  groups: GroupedMessage[];
  partMap: Record<string, SessionPart[]>;
  isCollapsed: (runId: string) => boolean;
  onToggleCollapse: (runId: string) => void;
  branding?: AgentBranding;
  renderToolDetail?: CustomToolRenderer;
  renderRunActions?: (group: Extract<GroupedMessage, { type: "run" }>["run"]) => ReactNode;
  renderUserMessageActions?: (message: SessionMessage, parts: SessionPart[]) => ReactNode;
  renderToolActions?: (
    part: ToolPart,
    options: {
      run: Extract<GroupedMessage, { type: "run" }>["run"];
      messageId: string;
      partIndex: number;
    },
  ) => ReactNode;
}

/**
 * Maps GroupedMessage[] to UserMessage and RunGroup components.
 * This is the main render list for the chat view.
 */
export const MessageList = memo(
  ({
    groups,
    partMap,
    isCollapsed,
    onToggleCollapse,
    branding,
    renderToolDetail,
    renderRunActions,
    renderUserMessageActions,
    renderToolActions,
  }: MessageListProps) => {
    return (
      <div className="space-y-4">
        {groups.map((group) => {
          if (group.type === "user") {
            const messageParts = partMap[group.message.id] ?? [];
            return (
              <UserMessage
                key={group.message.id}
                message={group.message}
                parts={messageParts}
                actions={renderUserMessageActions?.(group.message, messageParts)}
              />
            );
          }

          return (
            <RunGroup
              key={group.run.id}
              run={group.run}
              partMap={partMap}
              collapsed={isCollapsed(group.run.id)}
              onToggle={() => onToggleCollapse(group.run.id)}
              branding={branding}
              renderToolDetail={renderToolDetail}
              headerActions={renderRunActions?.(group.run)}
              renderToolActions={renderToolActions}
            />
          );
        })}
      </div>
    );
  },
);
MessageList.displayName = "MessageList";
