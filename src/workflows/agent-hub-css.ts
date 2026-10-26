/**
 * The hub layout's styles, scoped under `.ag-root` and shipped with the component
 * so a host without the package's Tailwind build still draws it. Colours are the
 * package's theme tokens, so light, dark and named themes follow the host.
 * Four type sizes (11, 12, 13, 14 px); spacing on a 4 px grid.
 */
export const AGENT_HUB_CSS = `
.ag-root { --ag-surface: hsl(var(--card)); --ag-fg: hsl(var(--foreground)); --ag-muted: hsl(var(--muted-foreground)); --ag-border: hsl(var(--border));
  --ag-line: color-mix(in oklab, var(--ag-fg) 14%, transparent); --ag-accent: hsl(var(--primary));
  color: var(--ag-fg); font-size: 13px; line-height: 18px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.ag-root * { box-sizing: border-box; }
.ag-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 24px; }
.ag-title { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
.ag-title-mark { width: 14px; height: 14px; border-radius: 4px; background: conic-gradient(from 45deg, var(--ag-accent), color-mix(in oklab, var(--ag-accent) 40%, transparent), var(--ag-accent)); -webkit-mask: radial-gradient(circle at 50% 50%, transparent 2.5px, #000 3px); mask: radial-gradient(circle at 50% 50%, transparent 2.5px, #000 3px); }
.ag-chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
.ag-chip-needs-you { color: var(--agent-graph-needs-you, hsl(38 92% 42%)); background: color-mix(in oklab, var(--agent-graph-needs-you, hsl(38 92% 50%)) 14%, transparent); }
.ag-chip-failed { color: var(--agent-graph-failed, hsl(0 72% 50%)); background: color-mix(in oklab, var(--agent-graph-failed, hsl(0 84% 60%)) 13%, transparent); }
.ag-stats { margin-left: auto; display: inline-flex; gap: 16px; color: var(--ag-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.ag-stats b { color: var(--ag-fg); font-weight: 500; }
.ag-canvas-wrap { position: relative; border: 1px solid var(--ag-border); border-radius: 12px; background: var(--ag-surface); overflow: hidden; }
.ag-canvas { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.ag-edges { position: absolute; inset: 0; overflow: visible; }
.ag-edge { fill: none; stroke: var(--ag-line); stroke-width: 1.25; }
.ag-edge-live { fill: none; stroke-width: 1.75; stroke-linecap: round; }
.ag-flow { stroke-dasharray: 28 var(--ag-len); animation: ag-travel 1.15s cubic-bezier(.4,0,.2,1) infinite; }
@keyframes ag-travel { from { stroke-dashoffset: 28px; } to { stroke-dashoffset: calc(-1 * var(--ag-len)); } }
.ag-root g, .ag-node { transition: opacity 180ms cubic-bezier(.2,.8,.2,1); }
.ag-dimmed { opacity: .22; }
.ag-node { position: absolute; display: flex; flex-direction: column; align-items: center; width: 132px; margin-left: -66px; margin-top: calc(var(--ag-tile) / -2);
  padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; outline: none; }
.ag-tile { position: relative; display: grid; place-items: center; width: var(--ag-tile); height: var(--ag-tile); border-radius: calc(var(--ag-tile) * .26);
  background: var(--ag-surface); border: 1px solid var(--ag-border); box-shadow: 0 1px 2px rgb(0 0 0 / .06), 0 4px 12px -6px rgb(0 0 0 / .18);
  transition: transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms; }
.ag-node:hover .ag-tile { transform: translateY(-1px); box-shadow: 0 2px 4px rgb(0 0 0 / .08), 0 8px 18px -8px rgb(0 0 0 / .28); }
.ag-node:focus-visible .ag-tile, .ag-selected .ag-tile { outline: 2px solid var(--ag-accent); outline-offset: 2px; }
.ag-node[style*="--ag-tone"] .ag-tile { border-color: color-mix(in oklab, var(--ag-tone) 55%, var(--ag-border)); background: color-mix(in oklab, var(--ag-tone) 9%, var(--ag-surface)); }
.ag-node-hub .ag-tile::before { content: ""; position: absolute; inset: -28px; z-index: -1; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in oklab, var(--ag-accent) 22%, transparent), transparent); }
.ag-node-you .ag-tile { background: var(--ag-fg); color: var(--ag-surface); border-color: transparent; }
.ag-name { margin-top: 6px; font-size: 13px; font-weight: 500; line-height: 16px; max-width: 132px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-node-tool .ag-name { font-weight: 400; color: var(--ag-muted); }
.ag-sub { font-size: 11px; line-height: 14px; color: var(--ag-muted); max-width: 132px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-badge { position: absolute; top: -5px; right: -5px; display: grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; color: #fff; font-size: 10px; font-weight: 700; box-shadow: 0 0 0 2px var(--ag-surface); }
.ag-badge-running { background: var(--ag-surface); color: var(--ag-accent); box-shadow: 0 0 0 1px var(--ag-border); }
.ag-badge-running svg, .ag-spin { animation: ag-spin .9s linear infinite; }
@keyframes ag-spin { to { transform: rotate(360deg); } }
.ag-legend { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; gap: 20px; color: var(--ag-muted); font-size: 12px; }
.ag-legend li { display: inline-flex; align-items: center; gap: 6px; }
.ag-legend-line { width: 14px; height: 2px; border-radius: 1px; }
.ag-popover { position: absolute; z-index: 5; width: 280px; padding: 12px; border-radius: 12px; background: hsl(var(--popover, var(--card))); color: var(--ag-fg);
  border: 1px solid var(--ag-border); box-shadow: 0 16px 40px -12px rgb(0 0 0 / .35), 0 2px 6px rgb(0 0 0 / .08); animation: ag-arrive 150ms cubic-bezier(.2,.8,.2,1); }
@keyframes ag-arrive { from { opacity: 0; transform: translateY(4px); } }
.ag-pop-head { display: flex; align-items: center; gap: 8px; }
.ag-tile-mini { border-radius: 8px; box-shadow: none; flex-shrink: 0; }
.ag-tile-micro { border-radius: 4px; box-shadow: none; flex-shrink: 0; border: 0; background: none; }
.ag-pop-title { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ag-pop-name { font-size: 14px; font-weight: 600; line-height: 18px; }
.ag-pop-sub { font-size: 12px; color: var(--ag-muted); line-height: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-pill { height: 20px; padding: 0 8px; border-radius: 6px; font-size: 11px; line-height: 20px; font-weight: 500; color: var(--ag-muted); background: color-mix(in oklab, var(--ag-fg) 7%, transparent); }
.ag-pill-failed { color: var(--agent-graph-failed, hsl(0 72% 50%)); background: color-mix(in oklab, var(--agent-graph-failed, hsl(0 84% 60%)) 13%, transparent); }
.ag-pill-needs-you { color: var(--agent-graph-needs-you, hsl(38 92% 42%)); background: color-mix(in oklab, var(--agent-graph-needs-you, hsl(38 92% 50%)) 14%, transparent); }
.ag-pill-running { color: var(--ag-accent); background: color-mix(in oklab, var(--ag-accent) 12%, transparent); }
.ag-pill-succeeded { color: var(--agent-graph-answer, hsl(152 60% 38%)); background: color-mix(in oklab, var(--agent-graph-answer, hsl(152 60% 45%)) 13%, transparent); }
.ag-close { display: grid; place-items: center; width: 24px; height: 24px; margin-right: -4px; border: 0; border-radius: 6px; background: none; color: var(--ag-muted); cursor: pointer; }
.ag-close:hover { background: color-mix(in oklab, var(--ag-fg) 7%, transparent); color: var(--ag-fg); }
.ag-close:focus-visible { outline: 2px solid var(--ag-accent); }
.ag-pop-summary { margin: 8px 0 0; font-size: 13px; line-height: 18px; }
.ag-pop-calls { list-style: none; margin: 8px 0 0; padding: 8px 0 0; border-top: 1px solid var(--ag-border); display: grid; gap: 6px; }
.ag-pop-calls li { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 16px; min-width: 0; }
.ag-pop-dir { color: var(--ag-muted); width: 12px; flex-shrink: 0; }
.ag-pop-call { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ag-muted); }
.ag-pop-call b { color: var(--ag-fg); font-weight: 500; }
.ag-pop-time { flex-shrink: 0; color: var(--ag-muted); font-variant-numeric: tabular-nums; display: inline-flex; }
.ag-pop-foot { margin: 8px 0 0; padding-top: 8px; border-top: 1px solid var(--ag-border); font-size: 12px; color: var(--ag-muted); display: flex; gap: 6px; }
.ag-pop-foot b { color: var(--ag-fg); font-weight: 600; }
@media (prefers-reduced-motion: reduce) {
  .ag-root *, .ag-root *::before { animation: none !important; transition: none !important; }
}
`;
