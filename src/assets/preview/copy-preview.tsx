import { Badge } from "@tangle-network/ui/primitives";
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

export const COPY_PLATFORM_LABEL: Record<CopyPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  sms: "SMS",
  "email-subject": "Email subject"
};

/** Copy as it will read: the channel and its length budget, the headline, the body and its hashtags. */
export function CopyPreview({ content, className }: CopyPreviewProps) {
  const limit = PLATFORM_LIMITS[content.platform];
  const length = content.body.length;
  const over = limit !== null && length > limit;
  const near = !over && limit !== null && length >= limit * 0.9;
  return (
    <article className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="text-xs">{COPY_PLATFORM_LABEL[content.platform] ?? content.platform}</Badge>
        {limit !== null && (
          <span className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : near ? "text-warning" : "text-muted-foreground")}>
            {length} / {limit} characters
          </span>
        )}
      </div>
      {content.headline && <h3 className="text-xl font-semibold leading-snug tracking-tight">{content.headline}</h3>}
      <p className="text-base leading-7 whitespace-pre-wrap [overflow-wrap:anywhere]">{content.body}</p>
      {content.hashtags && content.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-primary">
          {content.hashtags.map((tag) => <span key={tag}>#{tag.replace(/^#/, "")}</span>)}
        </div>
      )}
    </article>
  );
}
