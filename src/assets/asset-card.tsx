import { Badge } from "@tangle-network/ui/primitives";
import { Check, X, Pencil, GitBranch, Maximize2, Play } from "lucide-react";
import { cn } from "../lib/utils";
import { ImagePreview } from "./preview/image-preview";
import { ASSET_FORMAT_LABEL, ASSET_STATUS_LABEL } from "./labels";
import type { AssetSpec, AssetStatus, CopyContent, EmailContent, ImageContent, VideoContent } from "./types";

export interface AssetCardProps {
  spec: AssetSpec;
  variantCount?: number;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
  /** Opens the asset's detail view. When set, the thumbnail and card body are one click target. */
  onOpen?: (id: string) => void;
  className?: string;
}

const STATUS_VARIANT: Record<AssetStatus, "secondary" | "outline" | "default" | "destructive"> = {
  draft: "secondary",
  pending_review: "outline",
  approved: "default",
  rejected: "destructive",
  scheduled: "secondary",
  published: "default"
};

/** The URL of an image slide that is one picture with nothing layered on it. */
export function imageOnlyUrl(content: ImageContent): string | null {
  const slide = content.slides[0];
  return slide && slide.layers.length === 0 && slide.background.type === "image" ? slide.background.url : null;
}

/** The still frame a video asset carries: its first image scene or image slide. */
export function videoPosterUrl(content: VideoContent): string | null {
  for (const scene of content.scenes) {
    if (scene.type === "image-reveal") return scene.imageUrl;
    if (scene.type === "slide" && scene.slide.background.type === "image") return scene.slide.background.url;
  }
  return null;
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A short phrase that tells one asset from another of the same format. */
function assetSummary(spec: AssetSpec): string | null {
  if (spec.format === "email") return (spec.content as EmailContent).subject || null;
  if (spec.format.startsWith("copy:")) return (spec.content as CopyContent).headline || null;
  return null;
}

function Thumbnail({ spec }: { spec: AssetSpec }) {
  const { format, brand, content } = spec;
  if (format === "email") {
    const ec = content as EmailContent;
    return (
      <div className="flex h-full flex-col gap-1 p-3 text-sm">
        <div className="line-clamp-3 font-medium">{ec.subject}</div>
        <div className="text-xs text-muted-foreground">{ec.sections.length} sections</div>
      </div>
    );
  }
  if (format.startsWith("image:")) {
    const ic = content as ImageContent;
    const url = imageOnlyUrl(ic);
    if (url) {
      return <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />;
    }
    return (
      <div className="h-full overflow-hidden">
        <ImagePreview content={ic} brand={brand} format={format === "image:story" ? "story" : "feed"} />
      </div>
    );
  }
  if (format.startsWith("video:")) {
    const vc = content as VideoContent;
    const poster = videoPosterUrl(vc);
    return (
      <div className="relative h-full w-full">
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col gap-1 p-3 text-sm">
            <div className="font-medium">{vc.scenes.length} scenes</div>
          </div>
        )}
        <span className="pointer-events-none absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white">
          <Play size={18} className="translate-x-px" aria-hidden />
        </span>
        <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white tabular-nums">
          {formatDuration(vc.durationSeconds)}
        </span>
      </div>
    );
  }
  if (format.startsWith("copy:")) {
    const cc = content as CopyContent;
    return (
      <div className="flex h-full flex-col gap-1 p-3 text-sm">
        <div className="line-clamp-2 font-medium">{cc.headline}</div>
        <div className="line-clamp-4 text-xs text-muted-foreground">{cc.body}</div>
      </div>
    );
  }
  return null;
}

export function AssetCard({ spec, variantCount, onApprove, onReject, onEdit, onOpen, className }: AssetCardProps) {
  const formatLabel = ASSET_FORMAT_LABEL[spec.format] ?? spec.format;
  const statusLabel = ASSET_STATUS_LABEL[spec.status] ?? spec.status;
  const summary = assetSummary(spec);
  const hasActions = Boolean(onEdit || (spec.status === "pending_review" && (onReject || onApprove)));
  return (
    <div
      data-asset-id={spec.id}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-[border-color,box-shadow]",
        onOpen && "hover:border-primary/60 hover:shadow-md",
        className
      )}
    >
      {onOpen && (
        <button
          type="button"
          data-asset-open=""
          onClick={() => onOpen(spec.id)}
          aria-label={`Open ${formatLabel.toLowerCase()}${summary ? `: ${summary}` : ""}, ${statusLabel.toLowerCase()}`}
          className="absolute inset-0 z-[1] cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
      )}
      <div className="relative aspect-square overflow-hidden bg-muted/40">
        <Thumbnail spec={spec} />
        {onOpen && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Maximize2 size={14} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{formatLabel}</span>
        <Badge variant={STATUS_VARIANT[spec.status]} className="shrink-0 text-xs">{statusLabel}</Badge>
        {variantCount !== undefined && variantCount > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <GitBranch size={12} />
            {variantCount}
          </span>
        )}
      </div>
      {hasActions && (
        <div className="relative z-[2] flex border-t border-border bg-card">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(spec.id)}
              className="flex flex-1 items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {onReject && spec.status === "pending_review" && (
            <button
              type="button"
              onClick={() => onReject(spec.id)}
              className="flex flex-1 items-center justify-center gap-1 border-l border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            >
              <X size={12} />
              Reject
            </button>
          )}
          {onApprove && spec.status === "pending_review" && (
            <button
              type="button"
              onClick={() => onApprove(spec.id)}
              className="flex flex-1 items-center justify-center gap-1 border-l border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-green-600/5 hover:text-green-600"
            >
              <Check size={12} />
              Approve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
