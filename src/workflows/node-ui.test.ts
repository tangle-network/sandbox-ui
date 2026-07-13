import { describe, expect, it } from "vitest";
import type { WfNodeStatus } from "./model";
import {
  edgeColor,
  progressFill,
  STATUS_COLOR,
  STATUS_PILL,
  statusBorder,
} from "./node-ui";

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
  it("colors an edge by its target status, from the semantic (theme-aware) tokens", () => {
    expect(edgeColor("running")).toBe("hsl(var(--primary))");
    expect(edgeColor("succeeded")).toBe("var(--surface-success-text)");
    expect(edgeColor("failed")).toBe("var(--surface-danger-text)");
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

describe("status colors", () => {
  it("resolves every status through a token — no literal hex, no palette shade", () => {
    // A literal (`#22c55e`) or a stock Tailwind shade (`text-red-400`) carries ONE
    // value, so it can only ever be legible in one theme. Each status color must
    // therefore resolve through a var() that has a light AND a dark definition.
    for (const status of STATUSES) {
      expect(STATUS_COLOR[status]).toMatch(/^(hsl\()?var\(--/);
      expect(STATUS_COLOR[status]).not.toContain("var(--color-");
    }
  });

  it("gives every status pill a background, a text color, and a border", () => {
    for (const status of STATUSES) {
      const pill = STATUS_PILL[status];
      expect(pill.background).toBeTruthy();
      expect(pill.color).toBeTruthy();
      expect(pill.borderColor).toBeTruthy();
      for (const value of Object.values(pill)) {
        expect(value).not.toContain("var(--color-");
      }
    }
  });
});

describe("statusBorder", () => {
  it("borders a running/terminal node in its status color, and leaves a queued one at rest", () => {
    expect(statusBorder("running").borderColor).toBe(STATUS_COLOR.running);
    expect(statusBorder("succeeded").borderColor).toBe(STATUS_COLOR.succeeded);
    expect(statusBorder("failed").borderColor).toBe(STATUS_COLOR.failed);
    // A node the run hasn't reached yet wears the resting border — it is NOT
    // dimmed, which would only fight the contrast the rest of this design fixes.
    expect(statusBorder("queued").borderColor).toBe("hsl(var(--border))");
  });

  it("glows only the running node", () => {
    expect(statusBorder("running").boxShadow).toContain("24px");
    expect(statusBorder("queued").boxShadow).toBeUndefined();
  });

  it("returns a border color for every status", () => {
    for (const s of STATUSES) {
      expect(statusBorder(s).borderColor.length).toBeGreaterThan(0);
    }
  });
});
