import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ImageContent, ImageBackground, ImageLayer, ImageSlide, BrandTokens } from "../types";

export type ImageFormat = "feed" | "story" | "carousel";

export interface ImagePreviewProps {
  content: ImageContent;
  brand: BrandTokens;
  format?: ImageFormat;
  className?: string;
}

const ASPECT: Record<ImageFormat, string> = {
  feed: "aspect-square",
  story: "aspect-[9/16]",
  carousel: "aspect-square"
};

function bgStyle(bg: ImageBackground, brand: BrandTokens): React.CSSProperties {
  if (bg.type === "color") return { background: bg.value };
  if (bg.type === "gradient") return { background: `linear-gradient(${bg.direction ?? "to bottom right"}, ${bg.from}, ${bg.to})` };
  if (bg.type === "image") {
    return {
      backgroundImage: `url(${bg.url})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    };
  }
  return { background: brand.primaryColor };
}

function Layer({ layer, brand }: { layer: ImageLayer; brand: BrandTokens }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: `${layer.x}%`,
    top: `${layer.y}%`
  };
  if (layer.type === "text") {
    return (
      <div
        style={{
          ...base,
          fontSize: layer.fontSize ?? 16,
          fontWeight: layer.fontWeight ?? "normal",
          color: layer.color ?? brand.textColor,
          width: layer.width ? `${layer.width}%` : undefined,
          textAlign: layer.align ?? "left"
        }}
      >
        {layer.text}
      </div>
    );
  }
  if (layer.type === "image") {
    return (
      <img
        src={layer.url}
        alt=""
        style={{
          ...base,
          width: `${layer.width}%`,
          height: `${layer.height}%`,
          opacity: layer.opacity ?? 1,
          objectFit: "cover"
        }}
      />
    );
  }
  if (layer.type === "shape") {
    return (
      <div
        style={{
          ...base,
          width: `${layer.width}%`,
          height: `${layer.height}%`,
          background: layer.fill ?? brand.accentColor,
          opacity: layer.opacity ?? 1,
          borderRadius: layer.shape === "circle" ? "50%" : layer.shape === "rounded-rect" ? "8px" : 0
        }}
      />
    );
  }
  if (layer.type === "logo" && brand.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
        alt={brand.businessName}
        style={{
          ...base,
          width: layer.width ? `${layer.width}%` : "12%"
        }}
      />
    );
  }
  return null;
}

function Slide({ slide, brand }: { slide: ImageSlide; brand: BrandTokens }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={bgStyle(slide.background, brand)}>
      {slide.layers.map((layer, i) => (
        <Layer key={i} layer={layer} brand={brand} />
      ))}
    </div>
  );
}

export function ImagePreview({ content, brand, format = "feed", className }: ImagePreviewProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const slides = content.slides;
  const isMulti = slides.length > 1;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn("relative w-full rounded overflow-hidden", ASPECT[format])}>
        <Slide slide={slides[activeIndex]} brand={brand} />
        {isMulti && activeIndex > 0 && (
          <button
            onClick={() => setActiveIndex((i) => i - 1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full p-1 bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {isMulti && activeIndex < slides.length - 1 && (
          <button
            onClick={() => setActiveIndex((i) => i + 1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronRight size={16} />
          </button>
        )}
        {isMulti && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === activeIndex ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
      {isMulti && (
        <div className="text-xs text-muted-foreground text-center">
          {activeIndex + 1} / {slides.length}
        </div>
      )}
    </div>
  );
}
