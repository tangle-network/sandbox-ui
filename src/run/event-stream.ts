import { useEffect, useRef } from 'react'

/** Authenticated hosts own reconnects and session lifecycle; native streams use this lifecycle. */
export interface AgentStreamSource {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}
export type AgentStreamOpener = (url: string, onLiveChange?: (live: boolean) => void) => AgentStreamSource
export interface EventStreamHandlers {
  events: Readonly<Record<string, (event: MessageEvent<string>) => void>>
  opener?: AgentStreamOpener
  after?: () => number
  onStart?: () => void
  onLiveChange?: (live: boolean) => void
}

/** One owner for native reconnect, terminal end, stale callbacks and host-owned authenticated transports. */
export function useEventStream(url: string | undefined, handlers: EventStreamHandlers): void {
  const latest = useRef(handlers)
  latest.current = handlers
  const names = Object.keys(handlers.events).sort().join(',')
  useEffect(() => {
    if (!url || (!handlers.opener && typeof EventSource === 'undefined')) return
    let stopped = false, source: AgentStreamSource | undefined, retry: ReturnType<typeof setTimeout> | undefined
    latest.current.onStart?.()
    const open = () => {
      const target = new URL(url, globalThis.location?.href), after = latest.current.after?.()
      if (after !== undefined && after > 0) target.searchParams.set('after', String(after))
      let connection: AgentStreamSource
      const live = (value: boolean) => { if (!stopped && (!connection || source === connection)) latest.current.onLiveChange?.(value) }
      connection = handlers.opener ? handlers.opener(target.toString(), live) : new EventSource(target.toString())
      source = connection
      for (const name of new Set([...names.split(',').filter(Boolean), 'end'])) connection.addEventListener(name, event => {
        if (stopped || source !== connection) return
        if (name === 'end') { stopped = true; clearTimeout(retry); connection.close() }
        latest.current.events[name]?.(event)
      })
      if (!handlers.opener) {
        const native = connection as EventSource
        native.onopen = () => live(true)
        native.onerror = () => { connection.close(); if (stopped || source !== connection) return; live(false); retry = setTimeout(open, 1_000) }
      }
    }
    open()
    return () => { stopped = true; clearTimeout(retry); source?.close() }
  }, [url, handlers.opener, names])
}
