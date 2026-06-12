import { cn } from "../../lib/utils";
import type { CopyContent, CopyPlatform } from "../types";

export interface CopyPreviewProps {
  content: CopyContent;
  className?: string;
}

const PLATFORM_LIMITS: Record<CopyPlatform, number | null> = {
  instagram: 2200,
  tiktok: 2200,
  x: 280,
  linkedin: 3000,
  sms: 160,
  "email-subject": 60
};

const PLATFORM_LABELS: Record<CopyPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X / Twitter",
  linkedin: "LinkedIn",
  sms: "SMS",
  "email-subject": "Email Subject"
};

export function CopyPreview({ content, className }: CopyPreviewProps) {
  const limit = PLATFORM_LIMITS[content.platform];
  const bodyLen = content.body.length;
  const isOverLimit = limit !== null && bodyLen > limit;
  const warningThreshold = limit !== null ? limit * 0.9 : null;
  const isNearLimit = !isOverLimit && warningThreshold !== null && bodyLen >= warningThreshold;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{PLATFORM_LABELS[content.platform]}</span>
        {limit !== null && (
          <span className={cn("text-xs tabular-nums", isOverLimit ? "text-destructive font-medium" : isNearLimit ? "text-warning" : "text-muted-foreground")}>
            {bodyLen} / {limit}
          </span>
        )}
      </div>
      <div className="rounded border border-border p-3 space-y-2 bg-card">
        {content.headline && <div className="text-sm font-semibold">{content.headline}</div>}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content.body}</p>
        {content.hashtags && content.hashtags.length > 0 && (
          <div className="text-sm text-blue-500 flex flex-wrap gap-1">
            {content.hashtags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
