import { Fragment } from "react";
import { Play, Film, Loader2 } from "lucide-react";
import { Button } from "@tangle-network/ui/primitives";
import { cn } from "../../lib/utils";
import type { VideoContent, BrandTokens } from "../types";

export interface VideoPreviewProps {
  content: VideoContent;
  brand: BrandTokens;
  onRenderRequest?: () => void;
  isRendering?: boolean;
  className?: string;
}

export function VideoPreview({ content, brand, onRenderRequest, isRendering, className }: VideoPreviewProps) {
  if (content.renderedUrl) {
    return (
      <div className={cn("rounded overflow-hidden aspect-[9/16] bg-black", className)}>
        <video
          src={content.renderedUrl}
          controls
          className="w-full h-full object-contain"
          playsInline
        />
      </div>
    );
  }
  const sceneSummary = content.scenes.map((s) => {
    if (s.type === "text-animation") return s.headline;
    if (s.type === "image-reveal") return s.caption ?? "Image";
    if (s.type === "slide") return "Slide";
    if (s.type === "countdown") return `${s.from}…`;
    return "Scene";
  });
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="relative rounded overflow-hidden aspect-[9/16] flex flex-col items-center justify-center gap-3"
        style={{ background: brand.primaryColor, color: brand.textColor }}
      >
        <Film size={32} className="opacity-60" />
        <div className="text-sm font-medium text-center px-4">{brand.businessName}</div>
        <div className="text-xs opacity-60">
          {content.scenes.length} scenes {"\xB7"} {content.durationSeconds}s
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Scenes</div>
        {sceneSummary.map((label, i) => (
          <div key={i} className="text-xs text-muted-foreground flex gap-1.5 items-center">
            <span className="font-mono text-[10px] w-4 text-right opacity-50">{i + 1}</span>
            <span>{label}</span>
            <span className="opacity-40">{"\xB7"} {content.scenes[i].durationSeconds}s</span>
          </div>
        ))}
      </div>
      {onRenderRequest && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRenderRequest}
          disabled={isRendering}
          className="w-full gap-2"
        >
          {isRendering ? (
            <Fragment>
              <Loader2 size={14} className="animate-spin" />
              Rendering…
            </Fragment>
          ) : (
            <Fragment>
              <Play size={14} />
              Render in sandbox
            </Fragment>
          )}
        </Button>
      )}
    </div>
  );
}
