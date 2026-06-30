import { describe, it, expect } from "vitest";
import { clampReasoningLevel } from "./reasoning-level-picker";

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
    // codex caps at `high` → a stale `ultracode` lands on `high`, not "Auto".
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

  it("leaves the value untouched when the available set is unknown", () => {
    expect(clampReasoningLevel("ultracode", undefined)).toBe("ultracode");
  });
});
