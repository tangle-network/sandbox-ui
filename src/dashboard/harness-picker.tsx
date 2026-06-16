"use client";

import { BackendSelector, type BackendSelectorProps, type Backend } from "./backend-selector";
import { HarnessLogo } from "./harness-logo";

/**
 * Sandbox agent harness types — mirrors `BackendType` from
 * `@tangle-network/sandbox` SDK. Kept in lockstep with that enum:
 * if the SDK adds a backend, add it here too. The SDK's `pi`, `forge`,
 * `acp`, and `cursor` backends are deliberately deferred (not yet
 * surfaced in the picker) until their copy and compat policies land.
 */
export type HarnessType =
  | "opencode"
  | "claude-code"
  | "codex"
  | "amp"
  | "factory-droids"
  | "cli-base"
  | "kimi-code"
  | "openclaw"
  | "nanoclaw"
  | "hermes";

interface HarnessOption extends Backend {
  type: HarnessType;
  /**
   * Whether this harness can drive an interactive chat session. `false` for
   * shell-only backends (`cli-base`) that have no conversational agent — the
   * chat composer filters these out (see {@link chatCapableHarnesses}) while
   * scheduled/non-chat surfaces keep them.
   */
  chatCapable: boolean;
}

/**
 * Default option list with human-readable copy. Order is curated so the
 * recommended choice (`opencode`) appears first; `cli-base` (no agent) last.
 */
export const HARNESS_OPTIONS: readonly HarnessOption[] = [
  {
    type: "opencode",
    label: "OpenCode",
    description: "Default agent — broad model support, deterministic streaming",
    chatCapable: true,
  },
  {
    type: "claude-code",
    label: "Claude Code",
    description: "Native Claude skills and tools (requires ANTHROPIC_API_KEY)",
    chatCapable: true,
  },
  {
    type: "codex",
    label: "Codex",
    description: "OpenAI Codex CLI (requires OPENAI_API_KEY)",
    chatCapable: true,
  },
  {
    type: "amp",
    label: "AMP",
    description: "Sourcegraph AMP agent",
    chatCapable: true,
  },
  {
    type: "factory-droids",
    label: "Factory Droids",
    description: "Factory Droid agent",
    chatCapable: true,
  },
  {
    type: "kimi-code",
    label: "Kimi Code",
    description:
      "Moonshot Kimi Code CLI (Kimi subscription OAuth or MOONSHOT_API_KEY)",
    chatCapable: true,
  },
  {
    type: "openclaw",
    label: "OpenClaw",
    description: "Dispatcher routing to Claude / Codex / Gemini CLIs",
    chatCapable: true,
  },
  {
    type: "nanoclaw",
    label: "NanoClaw",
    description: "Local socket-bridge agent backend",
    chatCapable: true,
  },
  {
    type: "hermes",
    label: "Hermes",
    description: "Hermes inference-router agent",
    chatCapable: true,
  },
  {
    type: "cli-base",
    label: "CLI base (no agent)",
    description: "Shell tools only — for non-AI scheduled tasks",
    chatCapable: false,
  },
] as const;

/** Harness types that can drive an interactive chat session. */
export const chatCapableHarnesses: ReadonlyArray<HarnessType> = HARNESS_OPTIONS
  .filter((h) => h.chatCapable)
  .map((h) => h.type);

export interface HarnessPickerProps
  extends Omit<BackendSelectorProps, "backends" | "selected" | "onChange"> {
  value: HarnessType;
  onChange: (next: HarnessType) => void;
  /** Filter the available harnesses (e.g. by plan tier). Defaults to all. */
  available?: ReadonlyArray<HarnessType>;
  /** Override or extend the option metadata. Keys are HarnessType. */
  optionsOverride?: Partial<Record<HarnessType, Partial<Omit<HarnessOption, "type">>>>;
}

/**
 * Type-safe harness/backend selector for sandbox-backed agent products.
 *
 * Wraps the generic {@link BackendSelector} with the canonical harness list
 * baked in, so consumers don't have to re-declare it (or risk drifting from
 * the SDK enum).
 */
export function HarnessPicker({
  value,
  onChange,
  available,
  optionsOverride,
  label = "Agent harness",
  ...rest
}: HarnessPickerProps) {
  const allowed = new Set<HarnessType>(available ?? HARNESS_OPTIONS.map((h) => h.type));
  const backends: Backend[] = HARNESS_OPTIONS.filter((h) => allowed.has(h.type)).map((h) => {
    const override = optionsOverride?.[h.type];
    return {
      type: h.type,
      label: override?.label ?? h.label,
      description: override?.description ?? h.description,
      icon: <HarnessLogo type={h.type} size={20} />,
    };
  });

  return (
    <BackendSelector
      backends={backends}
      selected={value}
      onChange={(next) => onChange(next as HarnessType)}
      label={label}
      {...rest}
    />
  );
}
