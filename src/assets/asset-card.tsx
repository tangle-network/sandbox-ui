import { Badge } from "@tangle-network/ui/primitives";
import { Check, X, Pencil, GitBranch } from "lucide-react";
import { cn } from "../lib/utils";
import { ImagePreview } from "./preview/image-preview";
import type { AssetSpec, AssetStatus, VideoContent, CopyContent } from "./types";

export interface AssetCardProps {
  spec: AssetSpec;
  variantCount?: number;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
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

const STATUS_LABEL: Record<AssetStatus, string> = {
  draft: "Draft",
  pending_review: "Review",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published"
};

function Thumbnail({ spec }: { spec: AssetSpec }) {
  const { format, brand, content } = spec;
  if (format === "email") {
    const ec = content as import("./types").EmailContent;
    return (
      <div className="p-2 text-xs space-y-0.5">
        <div className="font-medium truncate">{ec.subject}</div>
        <div className="text-muted-foreground truncate text-[10px]">{ec.sections.length} sections</div>
      </div>
    );
  }
  if (format.startsWith("image:")) {
    const imgFormat = format === "image:story" ? "story" : "feed";
    return (
      <div className="overflow-hidden rounded" style={{ maxHeight: 120 }}>
        <ImagePreview
          content={content as import("./types").ImageContent}
          brand={brand}
          format={imgFormat}
        />
      </div>
    );
  }
  if (format.startsWith("video:")) {
    const vc = content as VideoContent;
    return (
      <div className="p-2 text-xs space-y-0.5">
        <div className="font-medium">{vc.scenes.length} scenes</div>
        <div className="text-muted-foreground">{vc.durationSeconds}s video</div>
      </div>
    );
  }
  if (format.startsWith("copy:")) {
    const cc = content as CopyContent;
    return (
      <div className="p-2 text-xs truncate space-y-0.5">
        <div className="font-medium truncate">{cc.headline}</div>
        <div className="text-muted-foreground line-clamp-2 text-[10px]">{cc.body}</div>
      </div>
    );
  }
  return null;
}

export function AssetCard({ spec, variantCount, onApprove, onReject, onEdit, className }: AssetCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card flex flex-col overflow-hidden hover:border-border/80 transition-colors", className)}>
      <div className="min-h-[80px] bg-muted/30">
        <Thumbnail spec={spec} />
      </div>
      <div className="px-2 py-1.5 flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground flex-1 truncate">{spec.format}</span>
        <Badge variant={STATUS_VARIANT[spec.status]} className="text-[10px] h-4 px-1.5">{STATUS_LABEL[spec.status]}</Badge>
        {variantCount !== undefined && variantCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <GitBranch size={10} />
            {variantCount}
          </span>
        )}
      </div>
      <div className="flex border-t border-border">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(spec.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
        {onReject && spec.status === "pending_review" && (
          <button
            type="button"
            onClick={() => onReject(spec.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors border-l border-border"
          >
            <X size={12} />
            Reject
          </button>
        )}
        {onApprove && spec.status === "pending_review" && (
          <button
            type="button"
            onClick={() => onApprove(spec.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-green-600 hover:bg-green-600/5 transition-colors border-l border-border"
          >
            <Check size={12} />
            Approve
          </button>
        )}
      </div>
    </div>
  );
}
