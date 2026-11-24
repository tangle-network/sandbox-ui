import { parse, walk } from "css-tree"

// A combinator starts a new compound. A class on an ancestor cannot qualify
// the element whose descendants :has() inspects.
function compounds(selector) {
  const result = [[]]
  for (const part of selector.children) {
    if (part.type === "Combinator") result.push([])
    else result.at(-1).push(part)
  }
  return result
}

function argumentsOf(pseudo) {
  const selectors = []
  walk(pseudo, {
    visit: "Selector",
    enter(selector) {
      selectors.push(selector)
      return walk.skip
    },
  })
  return selectors
}

function subject(parts) {
  let scoped = false
  for (const part of parts) {
    const name = typeof part.name === "string" ? part.name.toLowerCase() : ""
    if (part.type === "TypeSelector" && /^(?:html|body)$/.test(name)) return "root"
    if (["ClassSelector", "AttributeSelector", "IdSelector"].includes(part.type)) scoped = true
    if (part.type !== "PseudoClassSelector") continue
    if (name === "root") return "root"
    if (name === "is" || name === "where") {
      const alternatives = argumentsOf(part).map((selector) => subject(compounds(selector).at(-1)))
      if (alternatives.includes("root")) return "root"
      if (alternatives.length && alternatives.every((scope) => scope === "scoped")) scoped = true
    }
  }
  return scoped ? "scoped" : "unscoped"
}

function hasUnscopedSubject(selector, inherited = "unscoped") {
  const groups = compounds(selector)
  return groups.some((parts, index) => {
    let scope = subject(parts)
    // A logical pseudo-class tests the same element as its rightmost compound.
    if (index === groups.length - 1 && (scope === "unscoped" || inherited === "root")) scope = inherited
    return parts.some((part) => {
      if (part.type !== "PseudoClassSelector" && part.type !== "PseudoElementSelector") return false
      const name = part.name.toLowerCase()
      if (name === "has" && scope !== "scoped") return true
      const sameElement = ["is", "where", "not"].includes(name)
      return argumentsOf(part).some((child) => hasUnscopedSubject(child, sameElement ? scope : "unscoped"))
    })
  })
}

/** Check every rule in a compiled PostCSS Root, including conditional blocks. */
export function assertScopedHasSelectors(stylesheet) {
  stylesheet.walkRules(/:has\(/i, (rule) => {
    const selectors = parse(rule.selector, { context: "selectorList" })
    if (selectors.children.toArray().some((selector) => hasUnscopedSubject(selector))) {
      throw rule.error(`Unscoped :has() subject in ${rule.selector}. Scope it to a component class or attribute, or put page state directly on the document.`)
    }
  })
}
