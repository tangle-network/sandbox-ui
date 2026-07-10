import { describe, expect, it } from "vitest";
import type { WfNodeStatus } from "./model";
import { edgeColor, progressFill, statusBorder } from "./node-ui";

const STATUSES: WfNodeStatus[] = ["queued", "running", "succeeded", "failed"];

describe("progressFill", () => {
  it("maps each status to its determinate fill fraction", () => {
    expect(progressFill("queued")).toBe("6%");
    expect(progressFill("running")).toBe("58%");
    expect(progressFill("succeeded")).toBe("100%");
    expect(progressFill("failed")).toBe("100%");
  });

  it("returns a percentage string for every status", () => {
    for (const s of STATUSES) expect(progressFill(s)).toMatch(/^\d+%$/);
  });
});

describe("edgeColor", () => {
  it("colors an edge by its target status, using raw tokens/literals (never a --color-* alias)", () => {
    expect(edgeColor("running")).toBe("hsl(var(--primary))");
    expect(edgeColor("succeeded")).toBe("#22c55e");
    expect(edgeColor("failed")).toBe("#ef4444");
    expect(edgeColor("queued")).toBe("hsl(var(--muted-foreground))");
  });

  it("falls back to the muted neutral for the static (undefined) path", () => {
    // The definition/preview view passes no status — every edge must read neutral.
    expect(edgeColor(undefined)).toBe("hsl(var(--muted-foreground))");
  });

  it("never emits a --color-* @theme alias (undefined in tokens-only consumers)", () => {
    for (const s of [...STATUSES, undefined] as (WfNodeStatus | undefined)[]) {
      expect(edgeColor(s)).not.toContain("var(--color-");
    }
  });
});

describe("statusBorder", () => {
  it("returns the running ring, terminal borders, and the queued dim", () => {
    expect(statusBorder("running")).toBe("border-primary ring-1 ring-primary/40");
    expect(statusBorder("succeeded")).toBe("border-green-500");
    expect(statusBorder("failed")).toBe("border-red-500");
    expect(statusBorder("queued")).toBe("opacity-70");
  });

  it("returns a non-empty class for every status", () => {
    for (const s of STATUSES) expect(statusBorder(s).length).toBeGreaterThan(0);
  });
});
