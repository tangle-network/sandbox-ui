import { describe, expect, it } from "vitest";
import type { WfNodeStatus } from "./model";
import {
  edgeColor,
  progressFill,
  STATUS_BADGE,
  STATUS_COLOR,
  STATUS_LABEL,
  statusBorder,
} from "./node-ui";

const STATUSES: WfNodeStatus[] = [
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
];

describe("progressFill", () => {
  it("maps each status to its determinate fill fraction", () => {
    expect(progressFill("queued")).toBe("6%");
    expect(progressFill("running")).toBe("58%");
    // The run reached this node but hasn't finished it — same fill as running.
    // (The bar is deliberately not ANIMATED for `waiting`; see WorkflowNode.)
    expect(progressFill("waiting")).toBe("58%");
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

  it("rings a waiting node as prominently as a running one, in warning amber", () => {
    // The parked node is the one the viewer has to act on, so it must not fall to
    // the `queued` dim — and it must not borrow the primary accent, which would
    // say the run is working when it is blocked on them.
    const waiting = statusBorder("waiting");
    expect(waiting).toContain("ring-1");
    expect(waiting).toContain("surface-warning-border");
    expect(waiting).not.toContain("primary");
    expect(waiting).not.toContain("opacity-70");
  });

  it("returns a non-empty class for every status", () => {
    for (const s of STATUSES) expect(statusBorder(s).length).toBeGreaterThan(0);
  });
});

describe("waiting is a first-class status, never a flavour of running", () => {
  it("colors a waiting node and its inbound edge amber, not the running accent", () => {
    expect(STATUS_COLOR.waiting).toBe("var(--surface-warning-text)");
    expect(edgeColor("waiting")).toBe("var(--surface-warning-text)");
    expect(edgeColor("waiting")).not.toBe(edgeColor("running"));
  });

  it("labels it as blocked on the viewer, not as in-flight", () => {
    expect(STATUS_LABEL.waiting).toBe("Waiting on you");
    expect(STATUS_BADGE.waiting).toContain("surface-warning");
  });

  it("gives every status a colour, label, and badge — none may fall through", () => {
    for (const s of STATUSES) {
      expect(STATUS_COLOR[s]).toBeTruthy();
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_BADGE[s]).toBeTruthy();
    }
  });
});
