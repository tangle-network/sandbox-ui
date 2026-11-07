"use client"

import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { FlowSpan } from "@tangle-network/charts"
import { RunStatusIcon, type RunStatus } from "@tangle-network/ui/run"
import { formatCost, formatCount, formatSpanDuration } from "@tangle-network/ui/utils"
import { ArrowLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand"

export { usePhone } from "@tangle-network/ui/hooks"

const WIDTH_KEY = "sandbox-ui:trace-inspector-width", MIN_PX = 360, MIN_LEFT_PX = 320, STEP = 0.02
const readWidth = () => { try { const value = Number(localStorage.getItem(WIDTH_KEY)); return value > 0 && value < 1 ? value : 0.4 } catch { return 0.4 } }

/** The docked inspector's share of the workspace: dragged or arrowed, remembered for this viewer, never under 360px. */
export function useSplit(root: RefObject<HTMLElement | null>) {
  const [fraction, setFraction] = useState(0.4), [total, setTotal] = useState(0)
  useEffect(() => setFraction(readWidth()), [])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => requestAnimationFrame(() => setTotal(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [root])
  const max = total ? Math.max(MIN_PX, total - MIN_LEFT_PX) : Infinity
  const width = Math.round(Math.min(max, Math.max(MIN_PX, fraction * (total || 1000))))
  const commit = (next: number) => {
    const value = Math.min(0.85, Math.max(0.1, next))
    setFraction(value)
    try { localStorage.setItem(WIDTH_KEY, String(value)) } catch { /* private window: the width lasts this visit */ }
  }
  const separator = {
    role: "separator", tabIndex: 0, "aria-orientation": "vertical" as const, "aria-label": "Resize agent inspector",
    "aria-valuemin": total ? Math.round(MIN_PX / total * 100) : 0, "aria-valuemax": total ? Math.round(max / total * 100) : 100,
    "aria-valuenow": total ? Math.round(width / total * 100) : Math.round(fraction * 100),
    onKeyDown: (event: KeyboardEvent) => {
      const by = event.key === "ArrowLeft" ? STEP : event.key === "ArrowRight" ? -STEP : 0
      if (by) { event.preventDefault(); commit(width / (total || 1000) + by) }
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const box = root.current?.getBoundingClientRect()
      if (!box) return
      event.preventDefault()
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      const move = (next: globalThis.PointerEvent) => commit((box.right - next.clientX) / box.width)
      const stop = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); handle.removeEventListener("pointercancel", stop) }
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop)
    },
  }
  return { width, separator }
}

/** Text held to a few lines with a control to read the rest; the control appears only when lines are hidden. */
function Clamped({ text, lines, className }: { text: string; lines: 2 | 3; className?: string }) {
  const [open, setOpen] = useState(false), [over, setOver] = useState(false), ref = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || open) return
    const measure = () => setOver(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(() => requestAnimationFrame(measure))
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, open, lines])
  return (<div className="min-w-0">
    <p ref={ref} className={cn("m-0 whitespace-pre-wrap break-words", !open && (lines === 2 ? "line-clamp-2" : "line-clamp-3"), className)}>{text}</p>
    {(over || open) && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
      className="mt-0.5 rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]">{open ? "Show less" : "Show all"}</button>}
  </div>)
}

/** Fresh input, cached input and output as one stacked bar, so the split reads at a glance and its numbers stay in the line. */
function TokenBar({ fresh, cached, out }: { fresh: number; cached: number; out: number }) {
  const total = fresh + cached + out
  if (!total) return null
  const parts = [["fresh in", fresh, "var(--chart-series-1)"], ["cached in", cached, "var(--chart-muted)"], ["out", out, "var(--chart-series-2)"]] as const
  const label = parts.filter(([, value]) => value).map(([name, value]) => `${formatCount(value)} ${name}`).join(", ")
  return (<span role="img" aria-label={`Tokens: ${label}`} title={label} className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
    {parts.map(([name, value, color]) => value ? <span key={name} style={{ width: `${value / total * 100}%`, background: color }} /> : null)}
  </span>)
}

/** The header's one line of numbers, from the agent's own span: duration, cost and tokens; unknowns are left out. */
function metaOf(span: FlowSpan | undefined) {
  if (!span) return { line: [] as string[], tokens: undefined }
  const line: string[] = []
  if (span.endMs > span.startMs) line.push(formatSpanDuration(span.endMs - span.startMs))
  if (span.costUsd) line.push((span.costBound === "lower" ? "≥" : "") + formatCost(span.costUsd))
  const input = span.promptTokens ?? 0, out = span.completionTokens ?? 0, cached = Math.min(span.cachedTokens ?? 0, input)
  if (input) line.push(`${formatCount(input)} in`)
  if (out) line.push(`${formatCount(out)} out`)
  return { line, tokens: input || out ? { fresh: input - cached, cached, out } : undefined }
}

/** Facts the header already states are not repeated in Details. */
const IN_HEADER = /^(tokens|cost|duration|failure|model)$/i

export interface AgentInspectorProps {
  name: string
  model?: string
  status: RunStatus
  span?: FlowSpan
  live: boolean
  failure?: string
  /** The agent left no conversation: Details opens, since its facts are all there is to read. */
  silent?: boolean
  commission?: { by?: string; text?: string }
  facts: readonly { label: string; value: string }[]
  detail?: ReactNode
  /** The conversation, which fills every row the header, failure and commission leave. */
  children: ReactNode
  scroller: RefObject<HTMLDivElement | null>
  unseen: boolean
  onJump: () => void
  onClose: () => void
  mode: "docked" | "overlay" | "sheet"
  style?: CSSProperties
}

/** The selected agent: a compact header, its failure, its commission, then its conversation; recorded facts wait in Details. */
export function AgentInspector({ name, model, status, span, live, failure, silent, commission, facts, detail, children, scroller, unseen, onJump, onClose, mode, style }: AgentInspectorProps) {
  const brand = model ? modelBrandFor(model) : null, meta = metaOf(span)
  const details = facts.filter(fact => !IN_HEADER.test(fact.label) && fact.value !== failure)
  const sheetRef = useRef<HTMLElement>(null)
  const sheet = mode === "sheet"
  // A sheet takes focus when it opens and hands it back to whatever opened it when it closes.
  useEffect(() => {
    if (!sheet) return
    const opener = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // The sheet itself takes focus, so Back is not drawn with a focus ring the reader never asked for.
    sheetRef.current?.focus()
    return () => { document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus() }
  }, [sheet])
  return (
    <aside ref={sheetRef} tabIndex={sheet ? -1 : undefined} role={sheet ? "dialog" : undefined} aria-modal={sheet || undefined} aria-label={`${name} conversation`} style={style}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }}
      className={cn("relative flex min-h-0 flex-col overflow-hidden bg-card text-foreground outline-none",
        mode === "docked" && "shrink-0 rounded-xl border border-border",
        mode === "overlay" && "fixed inset-y-0 right-0 z-40 w-full max-w-[420px] border-l border-border shadow-2xl",
        sheet && "fixed inset-0 z-[1100] bg-background")}>
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-2.5">
        {sheet && <Button variant="ghost" size="sm" onClick={onClose} aria-label="Back to the run" className="-ml-1.5 shrink-0 gap-1 px-2">
          <ArrowLeft aria-hidden className="h-4 w-4" />Back
        </Button>}
        <div className={cn("min-w-0 flex-1", sheet && "pt-1.5")}>
          <div className="flex min-w-0 items-start gap-2">
            <RunStatusIcon status={status} className="mt-0.5 size-4 shrink-0" />
            <h3 className="m-0 min-w-0 flex-1 break-words text-sm font-semibold leading-5">{name}</h3>
            {live && <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--surface-info-text)]"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />Live</span>}
          </div>
          {(model || meta.line.length > 0) && <p className="m-0 mt-1 min-w-0 text-xs tabular-nums text-muted-foreground">
            {brand && <span className="mr-1.5 inline-flex align-[-3px]"><ModelBrandStack identity={brand} size="sm" /></span>}
            {[model, ...meta.line].filter(Boolean).join(" · ")}
          </p>}
          {meta.tokens && <div className="mt-1.5 max-w-[240px]"><TokenBar {...meta.tokens} /></div>}
        </div>
        {!sheet && <button type="button" aria-label="Close conversation" title="Close (Esc)" onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]">
          <X aria-hidden className="h-4 w-4" />
        </button>}
      </header>
      {failure && <section aria-label="Failure" className="shrink-0 border-b border-border px-3 py-2.5 text-sm font-medium leading-5 text-[var(--surface-danger-text)]">
        <Clamped text={failure} lines={3} />
      </section>}
      {commission && (commission.text || commission.by) && <section aria-label="Commission" className="shrink-0 border-b border-border px-3 py-2 text-sm">
        {commission.by && <p className="m-0 text-xs text-muted-foreground">from {commission.by}</p>}
        {commission.text && <Clamped text={commission.text} lines={2} />}
      </section>}
      <div ref={scroller} data-primary-content="" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{children}</div>
      {unseen && <button type="button" onClick={onJump}
        className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs shadow-sm">New output</button>}
      {(details.length > 0 || detail) && <details open={silent || undefined} className="group max-h-[45%] shrink-0 overflow-y-auto border-t border-border text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground before:hidden before:content-none [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />Details
        </summary>
        <section aria-label="Recorded agent details" tabIndex={0} className="px-3 pb-3">
          {details.length > 0 && <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1">{details.map((fact, index) => <div key={index} className="contents">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="m-0 whitespace-pre-wrap break-words text-xs">{fact.value}</dd>
          </div>)}</dl>}
          {detail}
        </section>
      </details>}
    </aside>
  )
}
