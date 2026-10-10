import { describe, expect, it } from "vitest";
import { buildWorkflowGraph, type WfNodeStatus } from "./model";
import {
  edgeColor,
  KIND_ICON,
  progressFill,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_PILL,
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
    // The run reached this node but has not finished it — same fill as running.
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
  it("colors only the LIVE FRONT — settled edges go quiet (2026-09 redesign)", () => {
    // The emphasis inversion: running/waiting/failed carry color; succeeded
    // and queued sit at a quiet neutral so a healthy run is not a green wall.
    expect(edgeColor("running")).toBe("hsl(var(--primary))");
    expect(edgeColor("waiting")).toBe("var(--surface-warning-text)");
    expect(edgeColor("failed")).toBe("var(--surface-danger-text)");
    expect(edgeColor("succeeded")).toBe(
      "color-mix(in srgb, hsl(var(--muted-foreground)) 38%, transparent)",
    );
  });

  it("falls back to the muted neutral for the static (undefined) path", () => {
    // The definition/preview view passes no status — every edge must read neutral.
    expect(edgeColor(undefined)).toBe(
      "color-mix(in srgb, hsl(var(--muted-foreground)) 38%, transparent)",
    );
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
  it("borders the live front and the failure; DONE IS QUIET (2026-09 redesign)", () => {
    expect(statusBorder("running").borderColor).toBe(STATUS_COLOR.running);
    // Done is quiet: the neutral resting border, no status hue, no ring —
    // the pill's check carries the state, the card does not paint itself green.
    expect(statusBorder("succeeded").borderColor).toBe("hsl(var(--foreground) / 0.14)");
    expect(statusBorder("succeeded").boxShadow).not.toContain("0 0 0");
    // Failed is the loudest pixel on the canvas: danger border + wide halo.
    expect(statusBorder("failed").borderColor).toBe(STATUS_COLOR.failed);
    expect(statusBorder("failed").boxShadow).toContain("0 0 32px");
    // A node the run hasn't reached yet wears the resting border.
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

describe("waiting is a first-class status, never a flavour of running", () => {
  it("colours a waiting node and its inbound edge amber, not the running accent", () => {
    // A run blocked on a human is not a run that is working. Borrowing the primary
    // "live" accent would say the opposite of what is true.
    expect(STATUS_COLOR.waiting).toBe("var(--surface-warning-text)");
    expect(edgeColor("waiting")).toBe(STATUS_COLOR.waiting);
    expect(edgeColor("waiting")).not.toBe(edgeColor("running"));
  });

  it("labels it as blocked on the viewer, not as in-flight", () => {
    expect(STATUS_LABEL.waiting).toBe("Waiting on you");
    expect(STATUS_PILL.waiting.color).toBe("var(--surface-warning-text)");
  });

  it("rings the parked node as prominently as the live one", () => {
    // It is the one node the viewer has to act on, so it must not fall back to the
    // quiet `queued` treatment — it carries the same glow, in amber.
    const waiting = statusBorder("waiting");
    expect(waiting.borderColor).toBe(STATUS_COLOR.waiting);
    expect(waiting.boxShadow).toBeTruthy();
    expect(waiting.boxShadow).toContain("24px");
    expect(waiting.borderColor).not.toBe(statusBorder("queued").borderColor);
  });

  it("gives every status a colour, label, and pill — none may fall through", () => {
    for (const s of STATUSES) {
      expect(STATUS_COLOR[s]).toBeTruthy();
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_PILL[s]).toBeTruthy();
    }
  });
});

/** A definition exercising every action and trigger kind the model names. New
 *  kinds belong here, which is what keeps the coverage test below honest. */
const EVERY_KIND_YAML = `
on:
  - provider_event:
      connection: github
      event: pull_request
  - schedule:
      cron: "0 9 * * *"
      timezone: UTC
  - webhook: {}
do:
  - sandbox.spawn: {}
  - integration.invoke:
      path: github.issues.create
  - notify:
      url: https://example.com
  - agent.run:
      prompt: Review it.
  - decision:
      title: Ship it?
  - script.run:
      source: "export default async () => ({ ok: true });"
  - sandbox.snapshot:
      sandbox: \${steps.spawn.sandboxId}
  - trace.analyze:
      trace: \${steps.run.traceRef.stepsPath}
  - parallel:
      branches:
        - notify:
            url: https://example.com/a
  - foreach:
      items: \${trigger.payload.items}
      do:
        notify:
          url: https://example.com/b
`;

describe("kind glyphs", () => {
  it("gives every kind the model emits an icon — none may fall through", () => {
    // The node mark resolves `KIND_ICON[kind] || Circle`. That fallback is right
    // for a kind from a NEWER api than this library, and wrong for one the model
    // already emits: such a node renders as an anonymous dot that looks
    // deliberate, so nobody notices the glyph was never wired. Deriving the kinds
    // from a real build (rather than listing them here) is what makes this fail
    // when a kind is added to the model and not to the table — the failure the
    // `webhook` trigger actually hit.
    const { nodes, error } = buildWorkflowGraph(EVERY_KIND_YAML);
    expect(error).toBeNull();
    const kinds = [...new Set(nodes.map((n) => n.data.kind))];
    // Guard the guard: if the fixture stops producing kinds, the check below
    // would pass vacuously.
    expect(kinds.length).toBeGreaterThanOrEqual(13);
    expect(kinds.filter((k) => !k || !KIND_ICON[k])).toEqual([]);
  });

  it("maps the graph-era kinds to distinct glyphs, not a shared placeholder", () => {
    // Three steps that do very different things (run code, capture a disk,
    // analyse a trace) must not read as the same node.
    const graphEra = ["script.run", "sandbox.snapshot", "trace.analyze"];
    for (const kind of graphEra) {
      // Defined, not "is a function": a lucide icon is a forwardRef component,
      // which types as an object.
      expect(KIND_ICON[kind]).toBeDefined();
    }
    expect(new Set(graphEra.map((k) => KIND_ICON[k])).size).toBe(
      graphEra.length,
    );
  });
});
