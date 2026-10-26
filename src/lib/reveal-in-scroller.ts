/**
 * Scrolls an element into view inside its nearest scrolling ancestor only. Element.scrollIntoView moves every scrolling
 * ancestor, the window included, so a pane that reveals its selection on load would jump the whole page.
 */
export function revealInScroller(element: Element, block: "nearest" | "center" = "nearest") {
  let scroller = parentOf(element)
  while (scroller && !scrolls(scroller)) scroller = parentOf(scroller)
  if (!scroller || scroller === document.scrollingElement || scroller === document.body) return
  const box = scroller.getBoundingClientRect()
  const target = element.getBoundingClientRect()
  const above = target.top - box.top
  const below = target.bottom - box.top - scroller.clientHeight
  if (block === "center") scroller.scrollTop += above - (scroller.clientHeight - target.height) / 2
  else if (above < 0) scroller.scrollTop += above
  else if (below > 0) scroller.scrollTop += Math.min(below, above)
}

// Walks out of a shadow root through its host, so code rendered in one still finds the pane that scrolls it.
function parentOf(node: Element): Element | null {
  return node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)
}

function scrolls(node: Element) {
  const { overflowY } = getComputedStyle(node)
  return (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight
}
