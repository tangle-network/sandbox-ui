import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HARNESS_OPTIONS, HarnessPicker, type HarnessType } from "./harness-picker";

describe("HARNESS_OPTIONS", () => {
  it("matches the BackendType enum exported by the sandbox SDK", () => {
    // If the SDK adds a backend, this list must be extended in lockstep.
    const expected: HarnessType[] = [
      "opencode",
      "claude-code",
      "codex",
      "amp",
      "factory-droids",
      "cli-base",
    ];
    expect(HARNESS_OPTIONS.map((h) => h.type)).toEqual(expected);
  });

  it("opencode is first (default-recommended)", () => {
    expect(HARNESS_OPTIONS[0].type).toBe("opencode");
  });

  it("every option has a non-empty description", () => {
    for (const h of HARNESS_OPTIONS) {
      expect(h.description, `harness ${h.type} missing description`).toBeTruthy();
    }
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
