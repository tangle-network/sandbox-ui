import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { harnessTypeSchema } from "@tangle-network/agent-interface";
import {
  HARNESS_OPTIONS,
  chatCapableHarnesses,
  HarnessPicker,
  type HarnessType,
} from "./harness-picker";

describe("HARNESS_OPTIONS", () => {
  it("contains only supported canonical harness values", () => {
    const expected: HarnessType[] = [
      "opencode",
      "claude-code",
      "codex",
      "amp",
      "factory-droids",
      "kimi-code",
      "openclaw",
      "nanoclaw",
      "hermes",
      "cli-base",
    ];
    const surfaced = HARNESS_OPTIONS.map((h) => h.type);

    expect(surfaced).toEqual(expected);
    for (const harness of surfaced) {
      expect(harnessTypeSchema.safeParse(harness).success).toBe(true);
    }
    for (const removedAlias of ["claude", "claudish", "kimi"]) {
      expect(harnessTypeSchema.safeParse(removedAlias).success).toBe(false);
      expect(surfaced).not.toContain(removedAlias);
    }
  });

  it("opencode is first (default-recommended)", () => {
    expect(HARNESS_OPTIONS[0].type).toBe("opencode");
  });

  it("every option has a non-empty description", () => {
    for (const h of HARNESS_OPTIONS) {
      expect(h.description, `harness ${h.type} missing description`).toBeTruthy();
    }
  });

  it("flags cli-base as the only non-chat-capable harness", () => {
    const nonChat = HARNESS_OPTIONS.filter((h) => !h.chatCapable).map((h) => h.type);
    expect(nonChat).toEqual(["cli-base"]);
  });

  it("chatCapableHarnesses excludes cli-base and includes opencode", () => {
    expect(chatCapableHarnesses).not.toContain("cli-base");
    expect(chatCapableHarnesses).toContain("opencode");
  });
});

describe("HarnessPicker", () => {
  it("renders the selected harness label in the trigger", () => {
    render(<HarnessPicker value="claude-code" onChange={() => {}} />);
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });

  it("respects the available filter (only renders allowed harnesses in trigger placeholder lookup)", () => {
    // When `value` is in `available`, the label resolves; when missing, placeholder shows.
    render(<HarnessPicker value="codex" onChange={() => {}} available={["opencode", "cli-base"]} />);
    // codex is not in the allowed list, so trigger should fall back to placeholder
    expect(screen.queryByText("Codex")).not.toBeInTheDocument();
  });

  it("uses optionsOverride for description text", () => {
    const { container } = render(
      <HarnessPicker
        value="opencode"
        onChange={() => {}}
        optionsOverride={{ opencode: { description: "Custom description override" } }}
      />,
    );
    expect(container.textContent).toContain("Custom description override");
  });
});
