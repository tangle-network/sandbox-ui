import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clampReasoningLevel,
  DEFAULT_REASONING_LEVEL_OPTIONS,
  HARNESS_REASONING_OPTIONS,
  ReasoningLevelPicker,
} from "./reasoning-level-picker";

describe("clampReasoningLevel", () => {
  it("keeps the `auto` sentinel regardless of the available set", () => {
    expect(clampReasoningLevel("auto", ["none", "low"])).toBe("auto");
  });

  it("keeps a value already within the available set", () => {
    expect(clampReasoningLevel("low", ["none", "minimal", "low", "medium"])).toBe(
      "low",
    );
  });

  it("snaps a value above the ceiling down to the highest available effort", () => {
    expect(
      clampReasoningLevel("ultracode", [
        "none",
        "minimal",
        "low",
        "medium",
        "high",
      ]),
    ).toBe("high");
  });

  it("snaps to `none` for a non-reasoning model (only `none` available)", () => {
    expect(clampReasoningLevel("high", ["none"])).toBe("none");
  });

  it("never increases a request when the available set starts above it", () => {
    expect(clampReasoningLevel("none", ["minimal", "low"])).toBe("auto");
  });

  it("snaps down across a sparse capability set", () => {
    expect(clampReasoningLevel("medium", ["none", "high"])).toBe("none");
  });

  it("leaves the value untouched when the available set is unknown", () => {
    expect(clampReasoningLevel("ultracode", undefined)).toBe("ultracode");
  });
});

describe("DEFAULT_REASONING_LEVEL_OPTIONS copy", () => {
  const descOf = (value: string) =>
    DEFAULT_REASONING_LEVEL_OPTIONS.find((o) => o.value === value)?.description;

  it("describes the high-end levels by intensity, not by a specific harness", () => {
    // The picker now filters per harness, so the shared copy must stay
    // harness-neutral — no "(Codex/OpenAI)" or "Claude Code's ultracode".
    expect(descOf("xhigh")).toBe("Extended reasoning for the hardest problems.");
    expect(descOf("ultracode")).toBe("Maximum extended thinking.");
    for (const option of DEFAULT_REASONING_LEVEL_OPTIONS) {
      expect(option.description).not.toMatch(/codex|openai|claude/i);
    }
  });
});

describe("HARNESS_REASONING_OPTIONS", () => {
  it("presents kimi's binary toggle as Auto / No thinking / Thinking", () => {
    const kimi = HARNESS_REASONING_OPTIONS["kimi-code"];
    expect(kimi?.map((o) => [o.value, o.label])).toEqual([
      ["auto", "Auto"],
      ["none", "No thinking"],
      ["high", "Thinking"],
    ]);
  });
});

describe("ReasoningLevelPicker — available filter", () => {
  const openMenu = () =>
    userEvent.click(screen.getByRole("button", { name: /reasoning level/i }));

  it("a bounded available set hides unsupported low- and high-end values", async () => {
    render(
      <ReasoningLevelPicker
        value="auto"
        onChange={() => {}}
        available={["minimal", "low", "medium", "high"]}
      />,
    );
    await openMenu();
    expect(await screen.findByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
    expect(screen.queryByText("Extra High")).not.toBeInTheDocument();
    expect(screen.queryByText("Ultracode")).not.toBeInTheDocument();
  });

  it("a claude-shaped available set hides `none`/`minimal` but reaches ultracode", async () => {
    render(
      <ReasoningLevelPicker
        value="auto"
        onChange={() => {}}
        available={["low", "medium", "high", "xhigh", "ultracode"]}
      />,
    );
    await openMenu();
    expect(await screen.findByText("Ultracode")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
    expect(screen.queryByText("Minimal")).not.toBeInTheDocument();
  });

  it("renders the kimi labels when given the kimi options + its available set", async () => {
    render(
      <ReasoningLevelPicker
        value="auto"
        onChange={() => {}}
        options={HARNESS_REASONING_OPTIONS["kimi-code"]}
        available={["none", "high"]}
      />,
    );
    await openMenu();
    expect(await screen.findByText("No thinking")).toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    // Never the raw depth-ladder labels — kimi isn't a gradient.
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
  });
});
