import { useEffect, useRef, useState } from 'react'

/** How soon a document the server marked stale (X-Workspace-Stale) is fetched again, backing off by half each time:
 * about a minute in all, the longest a plays index takes to recompose on a loaded host. */
const STALE_RETRY_MS = 2_500
const STALE_RETRIES = 6
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
    let timer = 0
    let stale = false
    let retries = 0
    // A request that never reached the server (GTR Chromium under load: ERR_NETWORK_CHANGED) is retried soon, not at the next poll.
    let dropped = 0
    let lost = false
    const controller = new AbortController()
    const load = async () => {
      lost = false
      try {
        const response = await fetcher(url, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          headers: etag.current ? { 'If-None-Match': etag.current } : {},
        })
        if (!alive) return
        dropped = 0
        stale = response.headers.get('X-Workspace-Stale') === '1'
        const failing = response.headers.get('X-Workspace-Compose-Error') ?? undefined
        // Only a fresh 200 or 304 ends a stale episode and restores its quick retries; an error answer is not fresh (root, #180).
        if (!stale && (response.ok || response.status === 304)) retries = 0
        if (response.status === 304) {
          setState((current) => (!current.error && current.stale === stale && current.failing === failing ? current : { ...current, loading: false, error: undefined, status: 304, stale, failing }))
          return
        }
        if (!response.ok) {
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
        etag.current = response.headers.get('ETag')
        const data = (await response.json()) as T
        if (alive) setState({ url, fetcher, data, loading: false, status: response.status, stale, failing })
      } catch (error) {
        if (alive && !controller.signal.aborted && dropped < NETWORK_RETRIES) lost = true
        else if (alive && !controller.signal.aborted)
          setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Request failed' }))
      } finally {
        // A document served as last composed while the server recomposes it is asked for again soon, a few times at most,
        // before the page's own poll: a polled page waited a whole interval and /today showed a 2 h old copy (REVIEW-7 #2).
        if (alive && lost) {
          timer = window.setTimeout(load, 1000 * 2 ** dropped)
          dropped += 1
        } else if (alive && stale && retries < STALE_RETRIES) {
          timer = window.setTimeout(load, STALE_RETRY_MS * 1.5 ** retries)
          retries += 1
        } else if (alive && poll) timer = window.setTimeout(load, poll)
      }
    }
    void load()
    return () => {
      alive = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [url, poll, fetcher]) // eslint-disable-line react-hooks/exhaustive-deps
  return state.fetcher === fetcher && (keepPrevious || state.url === url) ? state : { url, fetcher, loading: !!url }
}

