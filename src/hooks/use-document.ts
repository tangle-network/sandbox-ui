import { useEffect, useRef, useState } from 'react'

/** Initial delay for a document marked stale (X-Workspace-Stale), growing by half up to a one-minute ceiling. */
const STALE_RETRY_MS = 2_500
const STALE_RETRY_MAX_MS = 60_000
const NETWORK_RETRIES = 4

/**
 * Same-origin JSON with ETag revalidation. `poll` refetches every `poll` ms while set; turning polling on or off keeps
 * the document. With `keepPrevious`, a new URL (a record's next digest) keeps showing the previous document until the
 * new one arrives, so a run being written never blanks between versions. A response marked stale is refetched until it is current.
 */
export function useDocument<T>(url: string | null, poll?: number, keepPrevious = false, fetcher = globalThis.fetch) {
  // `stale`: the server sent its last composed copy while it recomposes (X-Workspace-Stale); a page says how old it is,
  // and `failing` why its last compose failed when it did (X-Workspace-Compose-Error, audit F11).
  // State and ETags belong to both the resource and authenticated fetcher.
  const [state, setState] = useState<{ url: string | null; fetcher: typeof fetcher; data?: T; error?: string; status?: number; loading: boolean; stale?: boolean; failing?: string }>({ url, fetcher, loading: !!url })
  const etag = useRef<string | null>(null)
  const shown = useRef<{ url: string | null; fetcher: typeof fetcher } | undefined>(undefined)
  useEffect(() => {
    const sameAccount = shown.current?.fetcher === fetcher
    if (shown.current?.url !== url || !sameAccount) {
      shown.current = { url, fetcher }
      etag.current = null
      setState((current) => (sameAccount && keepPrevious && url && current.data !== undefined ? { ...current, url, loading: true, error: undefined } : { url, fetcher, loading: !!url }))
    }
    if (!url) return
    let alive = true
    let timer: number | undefined
    let inFlight = false
    let revalidateOnShow = false
    let staleDelay = STALE_RETRY_MS
    let dropped = 0
    const controller = new AbortController()
    const load = async () => {
      if (!alive || inFlight) return
      inFlight = true
      let nextDelay = poll
      try {
        const response = await fetcher(url, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          headers: etag.current ? { 'If-None-Match': etag.current } : {},
        })
        if (!alive) return
        const stale = response.headers.get('X-Workspace-Stale') === '1'
        const failing = response.headers.get('X-Workspace-Compose-Error') ?? undefined
        revalidateOnShow = stale && (response.ok || response.status === 304)
        if (revalidateOnShow) {
          nextDelay = poll ? Math.min(poll, staleDelay) : staleDelay
          staleDelay = Math.min(STALE_RETRY_MAX_MS, staleDelay * 1.5)
        } else if (response.ok || response.status === 304) {
          staleDelay = STALE_RETRY_MS
        }
        if (response.status === 304) {
          dropped = 0
          setState((current) => (!current.error && current.stale === stale && current.failing === failing ? current : { ...current, loading: false, error: undefined, status: 304, stale, failing }))
          return
        }
        if (!response.ok) {
          dropped = 0
          let reason = `HTTP ${response.status}`
          try {
            const body = await response.json()
            if (body && typeof body === 'object' && typeof body.reason === 'string') reason = body.reason
          } catch {
            /* the status is the reason */
          }
          if (!alive) return
          const refused = [401, 403, 404].includes(response.status)
          if (refused) etag.current = null
          setState((current) => ({ ...(refused ? { url, fetcher } : current), loading: false, error: reason, status: response.status }))
          return
        }
        const data = (await response.json()) as T
        if (!alive) return
        dropped = 0
        etag.current = response.headers.get('ETag')
        setState({ url, fetcher, data, loading: false, status: response.status, stale, failing })
      } catch (error) {
        if (!alive) return
        revalidateOnShow = false
        if (dropped < NETWORK_RETRIES) {
          nextDelay = 1000 * 2 ** dropped
          dropped += 1
        } else {
          setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Request failed' }))
        }
      } finally {
        inFlight = false
        if (alive && nextDelay && !(revalidateOnShow && document.hidden)) {
          timer = window.setTimeout(load, nextDelay)
        }
      }
    }
    const onVisibility = () => {
      if (!revalidateOnShow) return
      window.clearTimeout(timer)
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void load()
    return () => {
      alive = false
      controller.abort()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [url, poll, fetcher]) // eslint-disable-line react-hooks/exhaustive-deps
  return state.fetcher === fetcher && (keepPrevious || state.url === url) ? state : { url, fetcher, loading: !!url }
}

