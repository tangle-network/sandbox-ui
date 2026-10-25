"use client"

import * as React from "react"
import { File } from "@pierre/diffs"

/** The one code theme: CodeSurface and DiffView share @pierre/diffs' Shiki highlighter and these themes. */
export const CODE_THEME = { dark: "github-dark", light: "github-light" } as const

export const CODE_FONT_FAMILY = 'var(--font-mono, "Geist Mono", "JetBrains Mono", ui-monospace, monospace)'

const CONTAINER_TAG = "diffs-container"

/** Follow the host's Brand theme (`data-theme` or the `light` class on <html>) unless the caller fixes one. */
export function useHostThemeType(explicit?: "light" | "dark"): "light" | "dark" {
  const read = () => {
    if (typeof document === "undefined") return "dark"
    const root = document.documentElement
    return root.getAttribute("data-theme") === "light" || root.classList.contains("light") ? "light" : "dark"
  }
  const [host, setHost] = React.useState<"light" | "dark">(read)
  React.useEffect(() => {
    if (explicit) return
    setHost(read())
    const observer = new MutationObserver(() => setHost(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
    return () => observer.disconnect()
  }, [explicit])
  return explicit ?? host
}

export interface CodeSurfaceProps {
  code: string
  /** Names the file and picks its grammar: every Shiki language, loaded on first use. */
  filename: string
  /** A Shiki language id that overrides the filename, such as `rust` for a file without an extension. */
  language?: string
  showLineNumbers?: boolean
  /** Wrap long lines inside the pane instead of scrolling sideways. */
  wrap?: boolean
  /** A 1-based line to select and scroll into view. */
  line?: number
  /** Defaults to the host's Brand theme. */
  themeType?: "light" | "dark"
  className?: string
}

/**
 * Read-only code renderer on @pierre/diffs' `File`, the same Shiki highlighter and theme as DiffView. A new
 * custom element per render survives StrictMode remounts; the surrounding element owns scrolling.
 */
export function CodeSurface({
  code,
  filename,
  language,
  showLineNumbers = true,
  wrap = false,
  line,
  themeType,
  className,
}: CodeSurfaceProps) {
  const theme = useHostThemeType(themeType)
  const hostRef = React.useRef<HTMLDivElement>(null)
  const instanceRef = React.useRef<File | null>(null)
  const containerRef = React.useRef<HTMLElement | null>(null)
  const latestTheme = React.useRef(theme)
  const appliedTheme = React.useRef(theme)
  const pendingLine = React.useRef<number | undefined>(line)

  React.useLayoutEffect(() => {
    latestTheme.current = theme
  }, [theme])

  // Lines render as plain text first and again once the grammar loads, so a requested line is revealed after
  // whichever render first contains it.
  const reveal = React.useCallback(() => {
    const target = pendingLine.current
    const element = target ? containerRef.current?.shadowRoot?.querySelector<HTMLElement>(`[data-line="${target}"]`) : null
    if (!target || !element) return
    pendingLine.current = undefined
    instanceRef.current?.setSelectedLines({ start: target, end: target })
    element.scrollIntoView({ block: "center" })
  }, [])

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (host == null) return
    const container = document.createElement(CONTAINER_TAG)
    container.style.setProperty("--diffs-font-family", CODE_FONT_FAMILY)
    container.style.display = "block"
    container.style.minWidth = "0"
    container.style.maxWidth = "100%"
    host.appendChild(container)
    containerRef.current = container
    const instance = new File({
      theme: CODE_THEME,
      themeType: latestTheme.current,
      overflow: wrap ? "wrap" : "scroll",
      disableFileHeader: true,
      disableLineNumbers: !showLineNumbers,
      onPostRender: () => reveal(),
    })
    instanceRef.current = instance
    appliedTheme.current = latestTheme.current
    instance.render({ file: { name: filename, contents: code, ...(language ? { lang: language } : {}) }, fileContainer: container })
    return () => {
      if (instanceRef.current === instance) instanceRef.current = null
      instance.cleanUp()
      container.remove()
    }
  }, [code, filename, language, showLineNumbers, wrap, reveal])

  React.useLayoutEffect(() => {
    if (appliedTheme.current === theme) return
    instanceRef.current?.setThemeType(theme)
    appliedTheme.current = theme
  }, [theme])

  React.useLayoutEffect(() => {
    pendingLine.current = line
    reveal()
  }, [line, reveal])

  return (
    <div
      ref={hostRef}
      data-code-surface=""
      role="region"
      aria-label={filename}
      tabIndex={0}
      className={className}
      style={{ height: "100%", minWidth: 0, overflow: "auto", fontSize: "var(--code-font-size, 0.8125rem)" }}
    />
  )
}
