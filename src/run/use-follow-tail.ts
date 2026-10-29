import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

/** Keeps the bottom through measured content growth, until the reader deliberately scrolls away. */
export function useFollowTail(scroller: RefObject<HTMLElement | null>, { identity, content, follow = true, target, thresholdPx = 24 }: {
  identity: unknown; content: unknown; follow?: boolean; target?: unknown; thresholdPx?: number
}) {
  const following = useRef(false), latest = useRef({ follow, target, thresholdPx })
  latest.current = { follow, target, thresholdPx }
  const [unseen, setUnseen] = useState(false)
  const jump = () => { const node = scroller.current; following.current = latest.current.follow; setUnseen(false); if (node) node.scrollTop = node.scrollHeight }
  useLayoutEffect(() => {
    following.current = latest.current.follow && !latest.current.target
    setUnseen(false)
    if (scroller.current && !latest.current.target) scroller.current.scrollTop = following.current ? scroller.current.scrollHeight : 0
  }, [identity])
  useLayoutEffect(() => { if (!follow) following.current = false }, [follow])
  useLayoutEffect(() => {
    const node = scroller.current
    if (!node) return
    const track = () => { following.current = latest.current.follow && node.scrollHeight - node.scrollTop - node.clientHeight < latest.current.thresholdPx; if (following.current) setUnseen(false) }
    node.addEventListener('scroll', track, { passive: true })
    return () => node.removeEventListener('scroll', track)
  }, [identity])
  useLayoutEffect(() => {
    const node = scroller.current
    if (!node) return
    const pin = () => { if (following.current) node.scrollTop = node.scrollHeight }
    if (!following.current) setUnseen(true)
    pin()
    const observer = new ResizeObserver(pin)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    return () => observer.disconnect()
  }, [content, follow, identity])
  return { following, unseen, jump }
}
