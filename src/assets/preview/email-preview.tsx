import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { EmailContent, EmailSection, BrandTokens } from "../types";

export interface EmailPreviewProps {
  content: EmailContent;
  brand: BrandTokens;
  previewUrl?: string;
  className?: string;
}

/** sRGB relative luminance of a #rgb or #rrggbb colour; null for anything else. */
function luminance(color: string): number | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PAPER = { light: "#ffffff", dark: "#111218" } as const;
const INK = { light: "#16171d", dark: "#f4f4f6" } as const;

/**
 * The colours an email body renders in. A brand whose text colour is light
 * writes on a dark page; any brand colour that would not read on that page
 * falls back to the page's own ink.
 */
export function emailPalette(brand: BrandTokens) {
  const text = luminance(brand.textColor);
  const scheme = text !== null && text > 0.5 ? "dark" : "light";
  const paper = PAPER[scheme];
  const paperLum = luminance(paper)!;
  const readable = (color: string, minimum: number) => {
    const lum = luminance(color);
    return lum !== null && contrast(lum, paperLum) >= minimum;
  };
  const ink = readable(brand.textColor, 4.5) ? brand.textColor : INK[scheme];
  const accent = readable(brand.primaryColor, 3) ? brand.primaryColor : ink;
  const primary = luminance(brand.primaryColor);
  // The label colour that reads best on the button, white unless near-black reads better.
  const buttonText = primary !== null && contrast(primary, 1) < contrast(primary, 0) ? "#111111" : "#ffffff";
  return { scheme, paper, ink, accent, button: brand.primaryColor, buttonText, quote: brand.accentColor };
}

function Button({ href, label, palette }: { href: string; label: string; palette: ReturnType<typeof emailPalette> }) {
  return (
    <a
      href={href}
      onClick={(event) => event.preventDefault()}
      className="inline-block rounded-md px-5 py-2.5 text-sm font-semibold no-underline"
      style={{ background: palette.button, color: palette.buttonText }}
    >
      {label}
    </a>
  );
}

function Section({ section, palette }: { section: EmailSection; palette: ReturnType<typeof emailPalette> }): ReactNode {
  const muted: CSSProperties = { color: palette.ink, opacity: 0.72 };
  switch (section.type) {
    case "hero":
      return (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          {section.imageUrl && <img src={section.imageUrl} alt="" className="w-full rounded-md object-cover" />}
          <h2 className="text-2xl font-bold leading-tight tracking-tight" style={{ color: palette.accent }}>{section.headline}</h2>
          {section.subheadline && <p className="text-base leading-relaxed" style={muted}>{section.subheadline}</p>}
          {section.ctaLabel && <div className="pt-1"><Button href={section.ctaUrl ?? "#"} label={section.ctaLabel} palette={palette} /></div>}
        </div>
      );
    case "body":
      return <p className="text-base leading-7 whitespace-pre-wrap">{section.text}</p>;
    case "feature":
      return (
        <div className="flex items-start gap-4">
          {section.imageUrl && <img src={section.imageUrl} alt="" className="size-16 shrink-0 rounded-md object-cover" />}
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold">{section.headline}</div>
            <div className="text-sm leading-relaxed" style={muted}>{section.description}</div>
          </div>
        </div>
      );
    case "testimonial":
      return (
        <blockquote className="border-l-4 pl-4" style={{ borderColor: palette.quote }}>
          <p className="text-base italic leading-relaxed">“{section.quote}”</p>
          <footer className="mt-2 text-sm font-medium" style={muted}>{section.author}{section.role ? `, ${section.role}` : ""}</footer>
        </blockquote>
      );
    case "cta":
      return (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <Button href={section.url} label={section.label} palette={palette} />
          {section.subtext && <p className="text-sm" style={muted}>{section.subtext}</p>}
        </div>
      );
    case "divider":
      return <hr className="border-0 border-t" style={{ borderColor: palette.ink, opacity: 0.15 }} />;
    default:
      return null;
  }
}

/**
 * An email as a reader meets it: who it is from, the subject and the inbox
 * preview line, then the body on the brand's page and in its typeface.
 */
export function EmailPreview({ content, brand, previewUrl, className }: EmailPreviewProps) {
  const palette = emailPalette(brand);
  return (
    <article className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}>
      <header className="flex flex-col gap-1 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: palette.button, color: palette.buttonText }}
          >
            {brand.businessName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="font-medium">{brand.businessName}</span>
        </div>
        <h3 className="text-base font-semibold leading-snug">{content.subject}</h3>
        {content.preheader && <p className="text-sm text-muted-foreground">{content.preheader}</p>}
      </header>
      {previewUrl ? (
        <iframe src={previewUrl} title="Email preview" sandbox="allow-same-origin" className="block h-[480px] w-full bg-white" />
      ) : (
        <div className="px-5 py-8 sm:px-8" style={{ background: palette.paper, color: palette.ink, fontFamily: brand.fontFamily }}>
          <div className="mx-auto flex max-w-[560px] flex-col gap-5">
            {content.sections.map((section, index) => <Section key={index} section={section} palette={palette} />)}
          </div>
        </div>
      )}
    </article>
  );
}
