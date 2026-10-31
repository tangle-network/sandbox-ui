"use client"

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Button } from "@tangle-network/ui/primitives"
import { revealInScroller } from "../lib/reveal-in-scroller"
import { cn } from "../lib/utils"
import { VirtualList } from "../run/record/VirtualList"

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
/** One value under its parent: the label it shows (a key, an index, or a JSON Lines line number) and a unique path. */
type Entry = { key: string | null; index: boolean; value: Json; path: string }
type Row = Entry & { depth: number; parent: string | null; posInSet: number; setSize: number }

export interface JsonViewProps {
  /** The file's text: one JSON value, or JSON Lines when `lines` is set. */
  text: string
  /** JSON Lines (`.jsonl`, `.ndjson`): each non-blank line is one value, labelled by its line number. */
  lines?: boolean
  /** Names the tree for assistive technology. */
  label?: string
  className?: string
}

/** Containers open level by level while the open rows stay within this; a larger level starts collapsed. */
const OPEN_ROWS = 400
const INDENT = 16
const isContainer = (value: Json): value is Json[] | { [key: string]: Json } => typeof value === "object" && value !== null
const pointer = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1")
const keyOf = (row: Row) => row.path

function children(value: Json, path: string): Entry[] {
  if (Array.isArray(value)) return value.map((child, i) => ({ key: String(i), index: true, value: child, path: `${path}/${i}` }))
  if (!isContainer(value)) return []
  return Object.entries(value).map(([key, child]) => ({ key, index: false, value: child, path: `${path}/${pointer(key)}` }))
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`
const size = (value: Json[] | { [key: string]: Json }) =>
  Array.isArray(value) ? count(value.length, "item", "items") : count(Object.keys(value).length, "key", "keys")

function parse(text: string, lines: boolean): { roots: Entry[]; summary: string } | { error: string } {
  if (!lines) {
    try {
      const value = JSON.parse(text) as Json
      return isContainer(value) ? { roots: children(value, ""), summary: size(value) } : { roots: [{ key: null, index: false, value, path: "$" }], summary: "One value" }
    } catch (error) {
      return { error: `This file is not valid JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  const roots: Entry[] = []
  const source = text.split("\n")
  for (let i = 0; i < source.length; i++) {
    if (!source[i]!.trim()) continue
    try {
      roots.push({ key: String(i + 1), index: true, value: JSON.parse(source[i]!) as Json, path: `/${i + 1}` })
    } catch (error) {
      return { error: `Line ${i + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  return { roots, summary: count(roots.length, "line", "lines") }
}

function initiallyOpen(roots: Entry[]): Set<string> {
  const open = new Set<string>()
  let shown = roots.length, level = roots.filter((entry) => isContainer(entry.value))
  while (level.length) {
    const next = level.flatMap((entry) => children(entry.value, entry.path))
    if (shown + next.length > OPEN_ROWS) break
    for (const entry of level) open.add(entry.path)
    shown += next.length
    level = next.filter((entry) => isContainer(entry.value))
  }
  return open
}

function everyContainer(roots: Entry[]): Set<string> {
  const open = new Set<string>()
  const visit = (entry: Entry) => { if (isContainer(entry.value)) { open.add(entry.path); children(entry.value, entry.path).forEach(visit) } }
  roots.forEach(visit)
  return open
}

function flatten(roots: Entry[], open: ReadonlySet<string>): Row[] {
  const rows: Row[] = []
  const walk = (entries: Entry[], depth: number, parent: string | null) => entries.forEach((entry, i) => {
    rows.push({ ...entry, depth, parent, posInSet: i + 1, setSize: entries.length })
    if (open.has(entry.path)) walk(children(entry.value, entry.path), depth + 1, entry.path)
  })
  walk(roots, 0, null)
  return rows
}

/** A collapsed container's first fields on one line, such as `{id: "OH-31", state: "US-OH", …}`. */
function preview(value: Json[] | { [key: string]: Json }): string {
  const parts: string[] = []
  let length = 0
  for (const [key, child] of Array.isArray(value) ? value.map((child, i) => [String(i), child] as const) : Object.entries(value)) {
    const shown = isContainer(child) ? (Array.isArray(child) ? "[…]" : "{…}") : typeof child === "string" && child.length > 40 ? JSON.stringify(`${child.slice(0, 39)}…`) : JSON.stringify(child)
    const part = Array.isArray(value) ? shown : `${key}: ${shown}`
    if (length + part.length > 160) { parts.push("…"); break }
    parts.push(part)
    length += part.length + 2
  }
  return Array.isArray(value) ? `[${parts.join(", ")}]` : `{${parts.join(", ")}}`
}

function Value({ value, open }: { value: Json; open: boolean }): ReactNode {
  if (isContainer(value)) return <>{!open && <span className="mr-2 opacity-80">{preview(value)}</span>}<span className="text-muted-foreground">{size(value)}</span></>
  if (typeof value === "string") return <span className="text-[var(--syntax-string,currentColor)]">"{value}"</span>
  return <span className={typeof value === "number" ? "text-[var(--syntax-number,currentColor)]" : "text-[var(--syntax-keyword,currentColor)]"}>{String(value)}</span>
}

/**
 * JSON and JSON Lines as a collapsible, virtualized tree: objects and arrays open and close, small documents open
 * whole, and long strings wrap. Rows render near the viewport of the nearest scrolling ancestor, so a file of
 * thousands of values stays fast. Keyboard: arrows move and open or close, Home/End jump, Enter or Space toggles.
 */
export function JsonView({ text, lines = false, label = lines ? "JSON Lines" : "JSON", className }: JsonViewProps) {
  const parsed = useMemo(() => parse(text, lines), [text, lines])
  const roots = "roots" in parsed ? parsed.roots : []
  const [open, setOpen] = useState<ReadonlySet<string>>(() => initiallyOpen(roots))
  const rows = useMemo(() => flatten(roots, open), [roots, open])
  const [focused, setFocused] = useState<string | null>(null)
  const [target, setTarget] = useState<string>()
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const pendingFocus = useRef<string | null>(null)
  const treeRef = useRef<HTMLDivElement | null>(null), scroller = useRef<HTMLElement | null>(null)
  const tabStop = rows.some((row) => row.path === focused) ? focused : rows[0]?.path ?? null

  const toggle = (path: string, value = !open.has(path)) => setOpen((current) => { const next = new Set(current); if (value) next.add(path); else next.delete(path); return next })
  const focusRow = (path: string | null | undefined) => {
    if (!path) return
    setFocused(path)
    const element = rowRefs.current.get(path)
    if (element) { setTarget(undefined); element.focus({ preventScroll: true }); revealInScroller(element) }
    else { pendingFocus.current = path; setTarget(path) }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: Row, at: number) => {
    const container = isContainer(row.value), expanded = open.has(row.path)
    const moves: Record<string, string | undefined> = { ArrowDown: rows[at + 1]?.path, ArrowUp: rows[at - 1]?.path, Home: rows[0]?.path, End: rows[rows.length - 1]?.path }
    if (event.key in moves) focusRow(moves[event.key])
    else if (event.key === "ArrowRight" && container) { if (expanded) focusRow(rows[at + 1]?.parent === row.path ? rows[at + 1]!.path : null); else toggle(row.path, true) }
    else if (event.key === "ArrowLeft") { if (expanded) toggle(row.path, false); else focusRow(row.parent) }
    else if ((event.key === "Enter" || event.key === " ") && container) toggle(row.path)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  if ("error" in parsed) return <div className={cn("flex flex-col gap-3 p-4", className)}><p role="alert" className="text-sm text-[var(--surface-danger-text)]">{parsed.error}</p>
    <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{text}</pre></div>

  const render = (row: Row, at: number) => {
    const container = isContainer(row.value), expanded = container && open.has(row.path)
    return (
      <div
        ref={(element) => {
          if (!element) { rowRefs.current.delete(row.path); return }
          rowRefs.current.set(row.path, element)
          if (pendingFocus.current === row.path) { pendingFocus.current = null; element.focus({ preventScroll: true }) }
        }}
        role="treeitem" aria-level={row.depth + 1} aria-posinset={row.posInSet} aria-setsize={row.setSize}
        aria-expanded={container ? expanded : undefined} tabIndex={row.path === tabStop ? 0 : -1} data-json-path={row.path}
        onFocus={() => setFocused(row.path)}
        onKeyDown={(event) => onKeyDown(event, row, at)}
        onClick={() => { if (container && !window.getSelection()?.toString()) toggle(row.path) }}
        style={{ paddingInlineStart: row.depth * INDENT + 4 }}
        className={cn(
          "relative flex min-h-6 items-start gap-1 rounded-sm pr-3 font-mono text-sm leading-6 text-foreground",
          "hover:bg-[var(--ix-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          container && "cursor-pointer",
        )}
      >
        {Array.from({ length: row.depth }, (_, level) => <span key={level} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-border" style={{ left: level * INDENT + 11 }} />)}
        <span aria-hidden="true" className="flex h-6 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {container && <ChevronRight className={cn("size-3.5 transition-transform duration-fast", expanded && "rotate-90")} />}
        </span>
        <span className={cn("min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]", container && !expanded && "truncate whitespace-nowrap")}>
          {row.key !== null && <><span className={row.index ? "text-muted-foreground" : "text-[var(--syntax-function,currentColor)]"}>{row.index ? row.key : JSON.stringify(row.key)}</span><span className="text-muted-foreground">: </span></>}
          <Value value={row.value} open={expanded} />
        </span>
      </div>
    )
  }
  const containers = roots.some((entry) => isContainer(entry.value))
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="sticky top-0 z-10 flex h-9 shrink-0 items-center gap-2 bg-card px-3 text-xs text-muted-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]">
        <span className="min-w-0 flex-1 truncate">{parsed.summary}</span>
        {containers && <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(everyContainer(roots))}>Expand all</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(new Set())}>Collapse all</Button>
        </>}
      </div>
      <div
        ref={(element) => {
          if (!element) return
          treeRef.current = element
          let parent = element.parentElement
          while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
          scroller.current = parent ?? (document.scrollingElement as HTMLElement | null)
        }}
        role="tree" aria-label={label} className="px-2 py-2"
      >
        <VirtualList items={rows} keyOf={keyOf} render={render} scroller={scroller} origin={treeRef} estimate={24} overscan={600} target={target} targetAlign="nearest" virtualize={rows.length > 200} keepMounted={tabStop ?? undefined} />
      </div>
    </div>
  )
}
