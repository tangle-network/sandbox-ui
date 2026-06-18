"use client";

import * as React from "react";
import { Bot, Plug, Terminal } from "lucide-react";
import { cn } from "../lib/utils";
import type { HarnessType } from "./harness-picker";
import ampLogo from "@lobehub/icons-static-svg/icons/amp.svg";
import claudeCodeLogo from "@lobehub/icons-static-svg/icons/claudecode.svg";
import codexLogo from "@lobehub/icons-static-svg/icons/codex.svg";
import hermesLogo from "@lobehub/icons-static-svg/icons/hermesagent.svg";
import moonshotLogo from "@lobehub/icons-static-svg/icons/moonshot.svg";
import openclawLogo from "@lobehub/icons-static-svg/icons/openclaw.svg";
import opencodeLogo from "@lobehub/icons-static-svg/icons/opencode.svg";

/**
 * Per-harness brand glyph. `logoUrl` is a bundled lobehub data-url rendered
 * as a CSS mask filled with the foreground token (single-color brand mark,
 * theme-safe). `icon` is an honest lucide fallback for harnesses that have
 * no published brand mark — never an invented logo.
 */
export interface HarnessBrand {
  label: string;
  logoUrl?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Presentation only — a Partial over the canonical HarnessType: the UI provides brand marks for the
// harnesses it surfaces, and any other canonical harness falls back to its name + a generic glyph.
export const HARNESS_BRAND: Partial<Record<HarnessType, HarnessBrand>> = {
  opencode: { label: "OpenCode", logoUrl: opencodeLogo },
  "claude-code": { label: "Claude Code", logoUrl: claudeCodeLogo },
  codex: { label: "Codex", logoUrl: codexLogo },
  amp: { label: "AMP", logoUrl: ampLogo },
  "kimi-code": { label: "Kimi Code", logoUrl: moonshotLogo },
  openclaw: { label: "OpenClaw", logoUrl: openclawLogo },
  hermes: { label: "Hermes", logoUrl: hermesLogo },
  // No published brand mark — honest lucide glyphs.
  "factory-droids": { label: "Factory Droids", icon: Bot },
  nanoclaw: { label: "NanoClaw", icon: Plug },
  "cli-base": { label: "CLI base", icon: Terminal },
};

export interface HarnessLogoProps {
  type: HarnessType;
  /** Chip edge length in px. Default 16 (matches the model pill glyph). */
  size?: number;
  className?: string;
}

/**
 * Brand chip for a harness, matching {@link BrandLogo}'s render contract in
 * model-picker: a rounded `bg-background ring-1 ring-border` chip wrapping
 * either a foreground-filled CSS-mask of the brand SVG or a lucide fallback
 * glyph. Keeps harness pills visually consistent with model pills.
 */
export function HarnessLogo({ type, size = 16, className }: HarnessLogoProps) {
  const brand: HarnessBrand = HARNESS_BRAND[type] ?? { label: type, icon: Bot };
  const Icon = brand.icon;
  return (
    <span
      title={brand.label}
      aria-label={brand.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-background shadow-sm ring-1 ring-border",
        className,
      )}
      style={{ height: size, width: size }}
    >
      {brand.logoUrl ? (
        <span
          aria-hidden
          className="h-[72%] w-[72%]"
          style={{
            backgroundColor: "hsl(var(--foreground))",
            maskImage: cssUrl(brand.logoUrl),
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: cssUrl(brand.logoUrl),
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      ) : Icon ? (
        <Icon className="h-[72%] w-[72%] text-muted-foreground" />
      ) : null}
    </span>
  );
}

/**
 * Wrap a URL for use inside a CSS `url("…")` value. Bundled SVG data-urls
 * carry raw quotes and hashes — valid in an `<img src>` but terminal inside
 * a CSS string — so percent-encode the characters CSS cannot carry.
 */
function cssUrl(url: string): string {
  return `url("${url.replace(/[\\"'#\n]/g, (char) => encodeURIComponent(char))}")`;
}
