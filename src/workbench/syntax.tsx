"use client"

import * as React from "react"
import type { CSSProperties } from "react"
import PrismLight from "react-syntax-highlighter/dist/esm/prism-light"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import css from "react-syntax-highlighter/dist/esm/languages/prism/css"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx"
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml"

// Register only the languages the sandbox surfaces actually render. The Light
// build ships no grammars by default, so this keeps the bundle lean and the
// highlighter deterministic.
let registered = false
function ensureLanguages() {
  if (registered) return
  registered = true
  PrismLight.registerLanguage("bash", bash)
  PrismLight.registerLanguage("css", css)
  PrismLight.registerLanguage("javascript", javascript)
  PrismLight.registerLanguage("json", json)
  PrismLight.registerLanguage("jsx", jsx)
  PrismLight.registerLanguage("markdown", markdown)
  PrismLight.registerLanguage("python", python)
  PrismLight.registerLanguage("tsx", tsx)
  PrismLight.registerLanguage("typescript", typescript)
  PrismLight.registerLanguage("yaml", yaml)
}

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  css: "css",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
}

/** Resolve a Prism language id from an explicit hint or the filename. */
export function resolveLanguage(filename: string, explicit?: string): string {
  if (explicit) return explicit
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXTENSION_LANGUAGE[ext] ?? "text"
}

// Restrained dark Prism theme wired to the brand `--syntax-*` tokens so
// highlighting tracks the active theme (dark / vault) instead of baking in a
// fixed palette. Backgrounds stay transparent — the surrounding surface owns
// the depth — and ligatures are disabled so `=>`, `!=`, `>=` read as code.
const codeBase: CSSProperties = {
  color: "var(--syntax-foreground, #E8E6F6)",
  background: "transparent",
  fontFamily: 'var(--font-mono, "Geist Mono", "JetBrains Mono", ui-monospace, monospace)',
  fontVariantLigatures: "none",
  fontFeatureSettings: "normal",
  fontSize: "var(--code-font-size, 0.8125rem)",
  lineHeight: "var(--code-line-height, 1.6)",
  tabSize: 2,
  hyphens: "none",
  direction: "ltr",
  textAlign: "left",
  whiteSpace: "pre",
  wordSpacing: "normal",
  wordBreak: "normal",
}

export const BRAND_PRISM_THEME: Record<string, CSSProperties> = {
  'code[class*="language-"]': codeBase,
  'pre[class*="language-"]': { ...codeBase, margin: 0, padding: 0, overflow: "auto" },
  comment: { color: "var(--syntax-comment, #6B7094)", fontStyle: "italic" },
  prolog: { color: "var(--syntax-comment, #6B7094)" },
  doctype: { color: "var(--syntax-comment, #6B7094)" },
  cdata: { color: "var(--syntax-comment, #6B7094)" },
  punctuation: { color: "var(--syntax-variable, #C4C0D8)" },
  namespace: { opacity: 0.7 },
  property: { color: "var(--syntax-variable, #C4C0D8)" },
  tag: { color: "var(--syntax-keyword, #A78FFF)" },
  "attr-name": { color: "var(--syntax-variable, #C4C0D8)" },
  "attr-value": { color: "var(--syntax-string, #10b981)" },
  boolean: { color: "var(--syntax-number, #FFB347)" },
  number: { color: "var(--syntax-number, #FFB347)" },
  constant: { color: "var(--syntax-number, #FFB347)" },
  symbol: { color: "var(--syntax-number, #FFB347)" },
  selector: { color: "var(--syntax-keyword, #A78FFF)" },
  "class-name": { color: "var(--syntax-function, #6D9FFF)" },
  string: { color: "var(--syntax-string, #10b981)" },
  char: { color: "var(--syntax-string, #10b981)" },
  builtin: { color: "var(--syntax-meta, #8263FF)" },
  inserted: { color: "var(--syntax-string, #10b981)" },
  deleted: { color: "var(--syntax-error, #FF4D6D)" },
  variable: { color: "var(--syntax-variable, #C4C0D8)" },
  operator: { color: "var(--syntax-variable, #C4C0D8)" },
  entity: { color: "var(--syntax-function, #6D9FFF)", cursor: "help" },
  url: { color: "var(--syntax-function, #6D9FFF)" },
  atrule: { color: "var(--syntax-keyword, #A78FFF)" },
  keyword: { color: "var(--syntax-keyword, #A78FFF)" },
  function: { color: "var(--syntax-function, #6D9FFF)" },
  regex: { color: "var(--syntax-meta, #8263FF)" },
  important: { color: "var(--syntax-error, #FF4D6D)", fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
}

export interface CodeSurfaceProps {
  code: string
  filename: string
  language?: string
  showLineNumbers?: boolean
  className?: string
}

/**
 * Read-only, brand-themed code renderer. Wrapped in a scroll container so the
 * highlighter itself never grows the layout; line numbers sit in a muted,
 * tabular column.
 */
export function CodeSurface({
  code,
  filename,
  language,
  showLineNumbers = true,
  className,
}: CodeSurfaceProps) {
  ensureLanguages()
  const lang = resolveLanguage(filename, language)

  return (
    <div
      className={className}
      style={{
        height: "100%",
        overflow: "auto",
        background: "transparent",
        padding: "0.75rem 0.5rem 0.75rem 0",
      }}
    >
      <PrismLight
        language={lang}
        style={BRAND_PRISM_THEME}
        showLineNumbers={showLineNumbers}
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontSize: "var(--code-font-size, 0.8125rem)",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'var(--font-mono, "Geist Mono", "JetBrains Mono", ui-monospace, monospace)',
            fontVariantLigatures: "none",
          },
        }}
        lineNumberStyle={{
          minWidth: "3em",
          paddingRight: "1em",
          textAlign: "right",
          color: "var(--syntax-comment, #6B7094)",
          opacity: 0.65,
          userSelect: "none",
        }}
      >
        {code}
      </PrismLight>
    </div>
  )
}
