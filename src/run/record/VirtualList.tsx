import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

type Scroller = RefObject<HTMLElement | null>
type Rows = { current: Map<string, HTMLDivElement> }

/** Row heights measured as rows render through `bind`; `version` changes when a measured height changes. */
function useMeasuredHeights() {
  const heights = useRef(new Map<string, number>())
  const rows: Rows = useRef(new Map())
  const observer = useRef<ResizeObserver | null>(null)
  const frame = useRef(0)
  const [version, setVersion] = useState(0)
  // Created on the first row binding: refs attach before effects run, so an effect-created observer would
  // miss every row of the first commit.
  const observe = (element: Element) => {
    if (!observer.current && typeof ResizeObserver !== 'undefined')
      observer.current = new ResizeObserver((entries) => {
        let changed = false
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.virtualKey
          if (!key) continue
          const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight)
          if (height > 0 && heights.current.get(key) !== height) { heights.current.set(key, height); changed = true }
        }
        if (changed && !frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setVersion((value) => value + 1) })
      })
    observer.current?.observe(element)
  }
  useEffect(() => {
    for (const row of rows.current.values()) observe(row)
    return () => { cancelAnimationFrame(frame.current); frame.current = 0; observer.current?.disconnect() }
  }, [])
  const bind = (key: string) => (element: HTMLDivElement | null) => {
    const previous = rows.current.get(key)
    if (previous) observer.current?.unobserve(previous)
    if (element) { rows.current.set(key, element); observe(element) } else rows.current.delete(key)
  }
  return { heights, rows, version, bind }
}

/** The scroller's visible window, measured from `origin` when the rows start below other content. */
function useViewport(scroller: Scroller, origin?: Scroller) {
  const [viewport, setViewport] = useState({ top: 0, height: 900 })
  const originTop = () => {
    const element = scroller.current, node = origin?.current
    return element && node ? node.getBoundingClientRect().top - (element === document.scrollingElement ? 0 : element.getBoundingClientRect().top + element.clientTop) + element.scrollTop : 0
  }
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = element.scrollTop - originTop()
      setViewport(current => current.top === top && current.height === element.clientHeight ? current : { top, height: element.clientHeight })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    const source = element === document.scrollingElement ? window : element
    source.addEventListener('scroll', schedule, { passive: true })
    if (source === window) window.addEventListener('resize', schedule)
    const resize = new ResizeObserver(schedule)
    resize.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      source.removeEventListener('scroll', schedule)
      if (source === window) window.removeEventListener('resize', schedule)
      resize.disconnect()
    }
  }, [scroller, origin])
  return { viewport, originTop }
}

/**
 * A target is settled, not jumped to once: rows above it are measured only after the first jump renders them, which
 * moves it. Each measurement, viewport move and change of the rows (a record that arrived late) re-aligns it until the
 * reader scrolls, or after two seconds. Home and End settle the first and last row the same way.
 */
function useSettleTarget<T>(scroller: Scroller, { target, align, items, keyOf, offsets, originTop, rows, version, viewport }: {
  target?: string; align: 'start' | 'nearest'; items: readonly T[]; keyOf: (item: T) => string; offsets: Float64Array
  originTop: () => number; rows: Rows; version: number; viewport: { top: number; height: number }
}) {
  const pending = useRef<{ key: string; until: number } | null>(null)
  const goal = (key: string) => ({ key, until: performance.now() + 2000 })
  const settle = () => {
    const current = pending.current
    if (!current) return
    if (performance.now() > current.until) { pending.current = null; return }
    const element = scroller.current, index = items.findIndex((item) => keyOf(item) === current.key)
    if (!element || index < 0) return
    const origin = originTop(), top = origin + offsets[index]!, bottom = origin + offsets[index + 1]!
    if (align === 'start' || top < element.scrollTop) element.scrollTop = Math.max(0, top - 8)
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = Math.max(0, bottom - element.clientHeight)
    // Bring a rendered target into the page's view as well as its own scroller.
    const row = rows.current.get(current.key)
    if (align === 'start' && row?.isConnected) {
      const box = row.getBoundingClientRect()
      if (box.top < 72 || box.top > window.innerHeight - 96) window.scrollBy({ top: box.top - 120 })
    }
  }
  useLayoutEffect(() => {
    pending.current = target ? goal(target) : null
    settle()
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(settle, [version, viewport, items]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    // The reader's own scroll ends the settling.
    const release = (event: Event) => {
      const key = event instanceof KeyboardEvent && event.target === element && !event.defaultPrevented ? event.key : ''
      pending.current = items.length && (key === 'Home' || key === 'End') ? goal(keyOf(items[key === 'Home' ? 0 : items.length - 1]!)) : null
      if (pending.current) { event.preventDefault(); settle() }
    }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const type of events) element.addEventListener(type, release, { passive: type === 'wheel' || type === 'touchstart' })
    return () => { for (const type of events) element.removeEventListener(type, release) }
  }, [scroller, items, keyOf, offsets]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Renders only the rows near the viewport of `scroller`. Row heights are measured as they render; unmeasured
 * rows use `estimate`. Spacers keep the scroll height, so the browser's scroll anchoring holds the reading place.
 */
export function VirtualList<T>({
  items,
  keyOf,
  render,
  scroller,
  estimate = 96,
  overscan = 900,
  target,
  origin,
  targetAlign = 'start',
  virtualize = true,
  keepMounted,
}: {
  items: readonly T[]
  keyOf: (item: T) => string
  render: (item: T, index: number) => ReactNode
  scroller: RefObject<HTMLElement | null>
  /** Height before a row is measured. */
  estimate?: number | ((item: T) => number)
  overscan?: number
  /** Bring this row to the top of the scroller (and into the page's view) whenever it changes. */
  target?: string
  /** Offset within an outer scroller, such as a file tree below its search header. */
  origin?: RefObject<HTMLElement | null>
  targetAlign?: 'start' | 'nearest'
  /** Preserve row identity as a collection crosses the virtualization threshold. */
  virtualize?: boolean
  /** Keep one roving tab stop mounted when the reader scrolls away from it. */
  keepMounted?: string
}) {
  const { heights, rows, version, bind } = useMeasuredHeights()
  const { viewport, originTop } = useViewport(scroller, origin)
  const offsets = useMemo(() => {
    const result = new Float64Array(items.length + 1)
    const guess = typeof estimate === 'function' ? estimate : () => estimate
    for (let i = 0; i < items.length; i++) result[i + 1] = result[i]! + (heights.current.get(keyOf(items[i]!)) ?? guess(items[i]!))
    return result
    // `version` changes when a measured height changes.
  }, [items, keyOf, estimate, version]) // eslint-disable-line react-hooks/exhaustive-deps
  useSettleTarget(scroller, { target, align: targetAlign, items, keyOf, offsets, originTop, rows, version, viewport })

  const find = (y: number) => {
    let low = 0, high = items.length
    while (low < high) { const mid = (low + high) >> 1; if (offsets[mid + 1]! <= y) low = mid + 1; else high = mid }
    return low
  }
  const start = virtualize ? Math.max(0, find(viewport.top - overscan)) : 0
  const end = virtualize ? Math.min(items.length, find(viewport.top + viewport.height + overscan) + 1) : items.length
  const indices = Array.from({ length: end - start }, (_, i) => start + i)
  const kept = keepMounted ? items.findIndex(item => keyOf(item) === keepMounted) : -1
  if (kept >= 0 && kept < start) indices.unshift(kept)
  else if (kept >= end) indices.push(kept)
  let previous = 0
  return <>
      {indices.map(index => {
        const item = items[index]!
        const key = keyOf(item)
        const space = offsets[index]! - offsets[previous]!
        previous = index + 1
        return (
          <Fragment key={key}>
            {space > 0 && <div style={{ height: space, transitionProperty: 'none' }} aria-hidden="true" />}
            <div ref={bind(key)} data-virtual-key={key} className="virtual-row" style={{ display: 'flow-root' }}>{render(item, index)}</div>
          </Fragment>
        )
      })}
      <div style={{ height: offsets[items.length]! - offsets[previous]!, transitionProperty: 'none' }} aria-hidden="true" />
    </>
}
