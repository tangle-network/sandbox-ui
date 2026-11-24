"use client";

import * as React from "react";
import { Bot, Terminal } from "lucide-react";
import { cn } from "../lib/utils";
import type { HarnessType } from "./harness-picker";
import ampLogo from "@lobehub/icons-static-svg/icons/amp.svg";
import claudeCodeLogo from "@lobehub/icons-static-svg/icons/claudecode-color.svg";
import codexLogo from "@lobehub/icons-static-svg/icons/codex.svg";
import hermesLogo from "@lobehub/icons-static-svg/icons/hermesagent.svg";
import kimiLogo from "@lobehub/icons-static-svg/icons/kimi-color.svg";
import zaiLogo from "@lobehub/icons-static-svg/icons/zai.svg";
import grokLogo from "@lobehub/icons-static-svg/icons/grok.svg";
import openclawLogo from "@lobehub/icons-static-svg/icons/openclaw.svg";
import opencodeLogo from "@lobehub/icons-static-svg/icons/opencode.svg";
import cursorLogo from "@lobehub/icons-static-svg/icons/cursor.svg";
import geminiCliLogo from "@lobehub/icons-static-svg/icons/geminicli-color.svg";
import acpLogo from "./harness-marks/acp.png";
import exoLogo from "./harness-marks/exo.svg";
import factoryLogo from "./harness-marks/factory.svg";
import nanoClawLogo from "./harness-marks/nanoclaw.png";
import nanoCodeLogo from "./harness-marks/nanocode.svg";
import piLogo from "./harness-marks/pi.svg";
import primeLogo from "./harness-marks/prime.png";

/** Shared real harness marks; full-color SVGs retain their original fills. */
export interface HarnessBrand {
  label: string;
  logoUrl?: string;
  fullColor?: boolean;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Presentation only — a Partial over the canonical HarnessType: the UI provides brand marks for the
// harnesses it surfaces, and any other canonical harness falls back to its name + a generic glyph.
export const HARNESS_BRAND: Partial<Record<HarnessType | "glm" | "kimi" | "grok" | "nanocode" | "exo", HarnessBrand>> = {
  opencode: { label: "OpenCode", logoUrl: opencodeLogo, color: "var(--tone-teal-icon)" },
  "claude-code": { label: "Claude Code", logoUrl: claudeCodeLogo, fullColor: true },
  codex: { label: "Codex", logoUrl: codexLogo, color: "hsl(var(--foreground))" },
  amp: { label: "AMP", logoUrl: ampLogo },
  "kimi-code": { label: "Kimi Code", logoUrl: kimiLogo, fullColor: true },
  openclaw: { label: "OpenClaw", logoUrl: openclawLogo },
  hermes: { label: "Hermes", logoUrl: hermesLogo },
  glm: { label: "GLM", logoUrl: zaiLogo },
  kimi: { label: "Kimi", logoUrl: kimiLogo, fullColor: true },
  grok: { label: "Grok", logoUrl: grokLogo },
  cursor: { label: "Cursor", logoUrl: cursorLogo },
  gemini: { label: "Gemini CLI", logoUrl: geminiCliLogo, fullColor: true },
  "factory-droids": { label: "Factory Droids", logoUrl: factoryLogo, fullColor: true },
  nanoclaw: { label: "NanoClaw", logoUrl: nanoClawLogo, fullColor: true },
  nanocode: { label: "NanoCode", logoUrl: nanoCodeLogo, fullColor: true },
  exo: { label: "Exo", logoUrl: exoLogo, fullColor: true },
  pi: { label: "Pi", logoUrl: piLogo, fullColor: true },
  prime: { label: "Prime Agent", logoUrl: primeLogo, fullColor: true },
  acp: { label: "ACP", logoUrl: acpLogo },
  "cli-base": { label: "CLI base", icon: Terminal },
};

export interface HarnessLogoProps {
  type: string;
  /** Recorded model shown with the harness name on hover. */
  model?: string;
  /** Chip edge length in px. Default 16 (matches the model pill glyph). */
  size?: number;
  className?: string;
}

/** One colored brand mark; a missing published mark uses the existing generic glyph. */
export function HarnessLogo({ type, model, size = 16, className }: HarnessLogoProps) {
  const key = type.toLowerCase().replace(/^claude$/, "claude-code").replace(/^glm(?:[-/].*)?$/, "glm").replace(/^kimi(?:[-/].*)?$/, "kimi").replace(/^grok(?:[-/].*)?$/, "grok");
  const brand: HarnessBrand = HARNESS_BRAND[key as keyof typeof HARNESS_BRAND] ?? { label: type, icon: Bot };
  const Icon = brand.icon;
  return (
    <span
      title={[brand.label, model].filter(Boolean).join(" · ")}
      aria-label={brand.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] text-[var(--harness-color)]",
        className,
      )}
      style={{ height: size, width: size, "--harness-color": brand.color ?? "var(--accent-text)", backgroundColor: brand.fullColor ? "hsl(var(--primary-foreground))" : "color-mix(in srgb, var(--harness-color) 12%, hsl(var(--background)))" } as React.CSSProperties}
    >
      {brand.logoUrl && brand.fullColor ? <img src={brand.logoUrl} alt="" className="h-[80%] w-[80%] object-contain" /> : brand.logoUrl ? (
        <span
          aria-hidden
          className="h-[80%] w-[80%]"
          style={{
            backgroundColor: "var(--harness-color)",
            mask: `${cssUrl(brand.logoUrl)} center / contain no-repeat`,
            WebkitMask: `${cssUrl(brand.logoUrl)} center / contain no-repeat`,
          }}
        />
      ) : Icon ? (
        <Icon className="h-[80%] w-[80%]" />
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
