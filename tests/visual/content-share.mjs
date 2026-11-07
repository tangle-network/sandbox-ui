/** Primary content owns the screen (Drew 11-04, 11-06): the open panel sits under one bar of at most 48 px, fills at
 * least 85 % of the viewport, and above its first chart, table, canvas, grid, code or conversation sits at most one title
 * and that chart's legend (112 px), never stacked page, section or filter headers. One measure for every app's proof;
 * moved here from the Lab viewer (tangle-network/disco #3159) so the Lab page and disco.tangle.tools read the same rule. */
export const BAR_MAX = 48, SHARE_MIN = 0.85, INSET_MAX = 112

/** The open panel: a shown tab panel, or whatever the host marks `data-content-panel`. */
export const PANEL = '[role="tabpanel"]:not([hidden]), [data-content-panel]'
/** What counts as content: a drawing, a table, a log, an agent graph or grid, code, or a conversation (`data-primary-content`). */
export const CONTENT = 'svg, canvas, table, [role="log"], [role="tree"], .react-flow, .ag-grid, .sandbox-code-view, [data-primary-content]'

export const measureContentShare = (page, panel = PANEL, content = CONTENT) => page.evaluate(([panelSelector, contentSelector]) => {
  const vh = innerHeight, vw = innerWidth
  const panel = document.querySelector(panelSelector)
  if (!panel) return { panel: null }
  const box = panel.getBoundingClientRect()
  const top = Math.max(0, box.top), bottom = Math.min(vh, box.bottom)
  let first = null
  for (const element of panel.querySelectorAll(contentSelector)) {
    const rect = element.getBoundingClientRect()
    if (rect.width < vw * 0.25 || rect.height < 40 || rect.bottom <= 0 || rect.top >= vh) continue
    first = Math.min(first ?? Infinity, Math.max(0, rect.top))
  }
  return { panel: { top: Math.round(top), bottom: Math.round(bottom) }, share: +((bottom - top) / vh).toFixed(3), contentTop: first === null ? null : Math.round(first), viewport: [vw, vh] }
}, [panel, content])

export const contentShareFailures = (where, m) => {
  if (!m.panel) return [`${where}: no open content panel`]
  const failures = []
  if (m.panel.top > BAR_MAX) failures.push(`${where}: ${m.panel.top} px of chrome above the panel (at most ${BAR_MAX})`)
  if (m.share < SHARE_MIN) failures.push(`${where}: panel fills ${(m.share * 100).toFixed(1)}% of the viewport (at least ${SHARE_MIN * 100}%)`)
  if (m.contentTop === null) failures.push(`${where}: no chart, table, canvas, grid, code or conversation at least a quarter of the viewport wide`)
  else if (m.contentTop - m.panel.top > INSET_MAX) failures.push(`${where}: first content starts ${m.contentTop - m.panel.top} px into the panel (at most ${INSET_MAX})`)
  return failures
}
