/**
 * The file tree shared by the vault page and workspace Files panels: folders
 * start collapsed, the reader's expansion is remembered per `storageKey` in this
 * browser, and opening or linking to a file reveals only that file's path. Two
 * trees given the same key share one remembered expansion.
 *
 * Rendering is lazy: only the children of expanded folders are walked or
 * mounted; folders retain their child paging, and collections over 100 visible
 * rows use the shared viewport list. Keyboard navigation reveals offscreen rows.
 *
 * The tree follows the WAI-ARIA tree pattern with a single tab stop: arrow keys
 * move between rows, Right/Left expand, collapse or move to a child or parent,
 * Home/End jump, and Enter or Space open a file or toggle a folder.
 *
 * Each row reads at a glance: a file-type glyph in its type's ink (Brand tone
 * icons), a 1 px guide per depth with the open file's parent guide stronger,
 * and, when the host passes `status`, an added / modified / deleted letter; a
 * collapsed folder holding changes carries a dot.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  BookOpen,
  Braces,
  ChevronRight,
  File,
  FileCode,
  FileCog,
  FileImage,
  FileLock,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Package,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import type { FileNode } from '@tangle-network/ui/files'
import { revealInScroller } from '../lib/reveal-in-scroller'
import { VirtualList } from '../run/record/VirtualList'

/** Children rendered per folder before a "Show more" row. */
export const VAULT_TREE_CHILD_PAGE = 200

const STORAGE_PREFIX = 'tangle:vault-tree:'
/** Stored folder paths kept per key; the oldest expansions drop first. */
const STORED_PATH_LIMIT = 1000

export interface VaultTreeProps {
  /** The listed collection; its children are the top-level rows. */
  root: FileNode
  /** The open file. Its row is marked selected and its folders are revealed when it changes. */
  selectedPath?: string
  /** A folder the host treats as current, such as a create target. */
  activeFolder?: string | null
  /** Called with a file's path when the reader opens it. */
  onSelect: (path: string) => void
  /** Called after the reader expands or collapses a folder. */
  onFolderToggle?: (path: string, expanded: boolean) => void
  /**
   * Called every time the reader activates a folder row (click, Enter or
   * Space), whether or not that changes its expansion, as when filtering.
   */
  onFolderSelect?: (path: string) => void
  /**
   * Remembers folder expansion in this browser under this key, for example
   * `${userId}:${workspaceId}`. Omit to keep expansion for the mounted tree only.
   */
  storageKey?: string
  /** Show every folder open without changing the remembered expansion, as while filtering. */
  expandAll?: boolean
  /** Accessible name of the tree. */
  label?: string
  /** A change mark per file path, such as a branch's diff against main. */
  status?: Readonly<Record<string, FileChange>>
  className?: string
}

export type FileChange = 'added' | 'modified' | 'deleted'
const CHANGE: Record<FileChange, { letter: string; ink: string }> = {
  added: { letter: 'A', ink: 'text-[var(--surface-success-text)]' },
  modified: { letter: 'M', ink: 'text-[var(--surface-warning-text)]' },
  deleted: { letter: 'D', ink: 'text-[var(--surface-danger-text)]' },
}
/** One indent step; guides sit on its centre line. */
const INDENT = 12

type TreeRow =
  | {
      kind: 'node'
      node: FileNode
      depth: number
      parent: string | null
      posInSet: number
      setSize: number
    }
  | { kind: 'more'; parent: string; depth: number; hidden: number }

function storageFor(key: string | undefined): Storage | null {
  if (!key || typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readExpanded(key: string | undefined): Set<string> {
  const storage = storageFor(key)
  if (!storage) return new Set()
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeExpanded(key: string | undefined, expanded: ReadonlySet<string>) {
  const storage = storageFor(key)
  if (!storage) return
  try {
    const paths = [...expanded].slice(-STORED_PATH_LIMIT)
    if (paths.length === 0) storage.removeItem(STORAGE_PREFIX + key)
    else storage.setItem(STORAGE_PREFIX + key, JSON.stringify(paths))
  } catch {
    // Storage can be full, blocked, or unavailable in a private window; the
    // tree keeps working with in-memory expansion.
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function sortChildren(children: FileNode[] | undefined): FileNode[] {
  if (!children?.length) return []
  return [...children].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return collator.compare(a.name, b.name)
  })
}

/** A file's glyph and ink by name, then extension: Brand's tone icons, each at least 3:1 on the card and a selected row. */
type FileKind = { Icon: LucideIcon; ink: string }
// Literal class names, so the style build's source scan finds every one.
const INK = {
  blue: 'text-[var(--tone-blue-icon)]',
  orange: 'text-[var(--tone-orange-icon)]',
  lime: 'text-[var(--tone-lime-icon)]',
  brown: 'text-[var(--tone-brown-icon)]',
  pink: 'text-[var(--tone-pink-icon)]',
  teal: 'text-[var(--tone-teal-icon)]',
  cyan: 'text-[var(--tone-cyan-icon)]',
  violet: 'text-[var(--tone-violet-icon)]',
} as const
const ink = (tone: keyof typeof INK) => INK[tone]
const BY_NAME: Record<string, FileKind> = {
  'readme.md': { Icon: BookOpen, ink: ink('blue') },
  'cargo.toml': { Icon: Package, ink: ink('orange') },
  'package.json': { Icon: Package, ink: ink('lime') },
  license: { Icon: Scale, ink: ink('brown') },
  'license.md': { Icon: Scale, ink: ink('brown') },
  dockerfile: { Icon: FileCog, ink: ink('blue') },
  makefile: { Icon: FileTerminal, ink: ink('brown') },
}
const BY_EXT: Record<string, FileKind> = {
  md: { Icon: FileText, ink: ink('blue') }, mdx: { Icon: FileText, ink: ink('blue') }, txt: { Icon: FileText, ink: 'text-muted-foreground' },
  pdf: { Icon: FileText, ink: ink('pink') }, doc: { Icon: FileText, ink: ink('blue') }, docx: { Icon: FileText, ink: ink('blue') },
  csv: { Icon: FileSpreadsheet, ink: ink('teal') }, tsv: { Icon: FileSpreadsheet, ink: ink('teal') }, xls: { Icon: FileSpreadsheet, ink: ink('teal') }, xlsx: { Icon: FileSpreadsheet, ink: ink('teal') },
  json: { Icon: Braces, ink: ink('lime') }, jsonl: { Icon: Braces, ink: ink('lime') },
  png: { Icon: FileImage, ink: ink('pink') }, jpg: { Icon: FileImage, ink: ink('pink') }, jpeg: { Icon: FileImage, ink: ink('pink') }, gif: { Icon: FileImage, ink: ink('pink') }, webp: { Icon: FileImage, ink: ink('pink') }, svg: { Icon: FileImage, ink: ink('pink') },
  ts: { Icon: FileCode, ink: ink('blue') }, tsx: { Icon: FileCode, ink: ink('blue') }, js: { Icon: FileCode, ink: ink('lime') }, jsx: { Icon: FileCode, ink: ink('lime') }, mjs: { Icon: FileCode, ink: ink('lime') }, cjs: { Icon: FileCode, ink: ink('lime') },
  rs: { Icon: FileCode, ink: ink('orange') }, py: { Icon: FileCode, ink: ink('blue') }, go: { Icon: FileCode, ink: ink('cyan') }, sh: { Icon: FileTerminal, ink: ink('brown') },
  html: { Icon: FileCode, ink: ink('orange') }, css: { Icon: FileCode, ink: ink('violet') },
  toml: { Icon: FileCog, ink: ink('violet') }, yaml: { Icon: FileCog, ink: ink('violet') }, yml: { Icon: FileCog, ink: ink('violet') }, ini: { Icon: FileCog, ink: ink('violet') },
  lock: { Icon: FileLock, ink: 'text-muted-foreground' },
}
function fileKind(name: string): FileKind {
  const lower = name.toLowerCase()
  if (BY_NAME[lower]) return BY_NAME[lower]
  if (lower.startsWith('.git')) return { Icon: GitBranch, ink: ink('orange') }
  const dot = lower.lastIndexOf('.')
  return (dot > 0 && BY_EXT[lower.slice(dot + 1)]) || { Icon: File, ink: 'text-muted-foreground' }
}

export function VaultTree({
  root,
  selectedPath,
  activeFolder,
  onSelect,
  onFolderToggle,
  onFolderSelect,
  storageKey,
  expandAll = false,
  label = 'Files',
  status,
  className,
}: VaultTreeProps) {
  const [expansion, setExpansion] = useState(() => ({ key: storageKey, expanded: readExpanded(storageKey) }))
  let keyed = expansion
  if (expansion.key !== storageKey) {
    keyed = { key: storageKey, expanded: readExpanded(storageKey) }
    setExpansion(keyed)
  }
  const expandedPaths = keyed.expanded

  const [pageLimits, setPageLimits] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const pendingFocusRef = useRef<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null), scroller = useRef<HTMLElement | null>(null)
  const [target, setTarget] = useState<string>()
  const previousPaths = useRef<Set<string> | null>(null)
  const animatedPaths = useRef(new Set<string>())
  const revealed = useRef<string | undefined>(undefined)

  const index = useMemo(() => {
    const nodes = new Map<string, FileNode>()
    const parents = new Map<string, string | null>()
    const children = new Map<string | null, FileNode[]>()
    const visit = (node: FileNode, parent: string | null) => {
      nodes.set(node.path, node)
      parents.set(node.path, parent)
      if (node.type === 'directory') {
        const sorted = sortChildren(node.children)
        children.set(node.path, sorted)
        for (const child of sorted) visit(child, node.path)
      }
    }
    const top = sortChildren(root.children)
    children.set(null, top)
    for (const node of top) visit(node, null)
    return { nodes, parents, children }
  }, [root])

  const isOpen = useCallback(
    (path: string) => expandAll || expandedPaths.has(path),
    [expandAll, expandedPaths],
  )

  const rows = useMemo<TreeRow[]>(() => {
    const out: TreeRow[] = []
    const walk = (parent: string | null, depth: number) => {
      const kids = index.children.get(parent) ?? []
      const limit = parent === null ? kids.length : Math.max(VAULT_TREE_CHILD_PAGE, pageLimits.get(parent) ?? 0)
      const shown = Math.min(kids.length, limit)
      kids.slice(0, shown).forEach((node, i) => {
        out.push({ kind: 'node', node, depth, parent, posInSet: i + 1, setSize: kids.length })
        if (node.type === 'directory' && isOpen(node.path)) walk(node.path, depth + 1)
      })
      if (parent !== null && shown < kids.length) {
        out.push({ kind: 'more', parent, depth, hidden: kids.length - shown })
      }
    }
    walk(null, 0)
    return out
  }, [index, isOpen, pageLimits])

  const nodeRows = useMemo(() => rows.filter((row): row is Extract<TreeRow, { kind: 'node' }> => row.kind === 'node'), [rows])

  const updateExpanded = useCallback((change: (next: Set<string>) => void) => {
    setExpansion((current) => {
      const base = current.key === storageKey ? current.expanded : readExpanded(storageKey)
      const next = new Set(base)
      change(next)
      writeExpanded(storageKey, next)
      return { key: storageKey, expanded: next }
    })
  }, [storageKey])

  const setFolderOpen = useCallback((path: string, open: boolean) => {
    // While every folder is shown open (filtering), the remembered expansion
    // is not what the reader sees, so a toggle would change nothing visible.
    if (expandAll || expandedPaths.has(path) === open) return
    updateExpanded((next) => {
      if (open) next.add(path)
      else next.delete(path)
    })
    onFolderToggle?.(path, open)
  }, [expandAll, expandedPaths, updateExpanded, onFolderToggle])

  // Reveal once per selection, respecting later manual collapse and scroll.
  useEffect(() => {
    if (!selectedPath || !index.nodes.has(selectedPath)) { revealed.current = undefined; return }
    if (revealed.current === selectedPath) return
    revealed.current = selectedPath
    const ancestors: string[] = []
    for (let parent = index.parents.get(selectedPath) ?? null; parent; parent = index.parents.get(parent) ?? null) {
      ancestors.push(parent)
    }
    setTarget(selectedPath)
    // Linking beyond the current child page must reveal that file, not a permanent missing selection.
    setPageLimits(current => {
      const next = new Map(current)
      for (const path of [selectedPath, ...ancestors]) {
        const parent = index.parents.get(path) ?? null
        if (parent) next.set(parent, Math.max(next.get(parent) ?? VAULT_TREE_CHILD_PAGE, (index.children.get(parent)?.findIndex(n => n.path === path) ?? -1) + 1))
      }
      return next
    })
    if (ancestors.some((path) => !expandedPaths.has(path))) {
      updateExpanded((next) => {
        for (const path of ancestors) next.add(path)
      })
    }
  }, [selectedPath, index]) // eslint-disable-line react-hooks/exhaustive-deps

  const visiblePaths = useMemo(() => new Set(nodeRows.map((row) => row.node.path)), [nodeRows])
  const tabStop = (focusedPath && visiblePaths.has(focusedPath) && focusedPath)
    || (selectedPath && visiblePaths.has(selectedPath) && selectedPath)
    || nodeRows[0]?.node.path
    || null

  const focusRow = useCallback((path: string | null | undefined) => {
    if (!path) return
    setFocusedPath(path)
    const element = rowRefs.current.get(path)
    if (element) { setTarget(undefined); element.focus({ preventScroll: true }); revealInScroller(element) }
    else { pendingFocusRef.current = path; setTarget(path) }
  }, [])

  const activate = useCallback((node: FileNode) => {
    setFocusedPath(node.path)
    if (node.type === 'directory') {
      setFolderOpen(node.path, !isOpen(node.path))
      onFolderSelect?.(node.path)
    } else onSelect(node.path)
  }, [isOpen, onSelect, onFolderSelect, setFolderOpen])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, node: FileNode) => {
    const at = nodeRows.findIndex((row) => row.node.path === node.path)
    if (at < 0) return
    const dir = node.type === 'directory'
    const open = dir && isOpen(node.path)
    let handled = true
    const moves: Record<string, string | undefined> = {
      ArrowDown: nodeRows[at + 1]?.node.path,
      ArrowUp: nodeRows[at - 1]?.node.path,
      Home: nodeRows[0]?.node.path,
      End: nodeRows[nodeRows.length - 1]?.node.path,
    }
    if (event.key in moves) focusRow(moves[event.key])
    else switch (event.key) {
      case 'ArrowRight':
        if (dir && !open) setFolderOpen(node.path, true)
        else if (open) {
          const child = nodeRows[at + 1]
          if (child?.parent === node.path) focusRow(child.node.path)
        }
        break
      case 'ArrowLeft':
        if (open && !expandAll) setFolderOpen(node.path, false)
        else focusRow(index.parents.get(node.path))
        break
      case 'Enter':
      case ' ':
        activate(node)
        break
      default:
        handled = false
    }
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [nodeRows, isOpen, focusRow, setFolderOpen, expandAll, index, activate])

  const changedFolders = useMemo(() => {
    const out = new Map<string, FileChange>()
    for (const [path, change] of Object.entries(status ?? {})) {
      let cut = path.lastIndexOf('/')
      while (cut > 0) {
        const folder = path.slice(0, cut)
        if (out.get(folder) !== 'modified') out.set(folder, change === 'added' ? 'added' : 'modified')
        cut = folder.lastIndexOf('/')
      }
    }
    return out
  }, [status])
  const openParent = selectedPath ? index.parents.get(selectedPath) ?? null : null
  // New source paths arrive once; viewport remounts during scrolling do not replay their entrance.
  const arrivals = useMemo(() => new Set(previousPaths.current ? [...index.nodes.keys()].filter(path => !previousPaths.current!.has(path)) : []), [index])
  useEffect(() => {
    previousPaths.current = new Set(index.nodes.keys())
    for (const path of animatedPaths.current) if (!index.nodes.has(path)) animatedPaths.current.delete(path)
  }, [index])
  const keyOf = (row: TreeRow) => row.kind === 'node' ? row.node.path : `more:${row.parent}`
  const render = (row: TreeRow) => {
        if (row.kind === 'more') {
          return (
            <button
              key={`more:${row.parent}`}
              type="button"
              onClick={() => {
                focusRow(index.children.get(row.parent)?.[(index.children.get(row.parent)?.length ?? 0) - row.hidden]?.path)
                setPageLimits(current => {
                  const next = new Map(current)
                  next.set(row.parent, Math.max(VAULT_TREE_CHILD_PAGE, current.get(row.parent) ?? 0) + VAULT_TREE_CHILD_PAGE)
                  return next
                })
              }}
              style={{ paddingInlineStart: row.depth * INDENT + 28 }}
              className="flex min-h-8 w-full items-center rounded-md pr-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              Show {Math.min(row.hidden, VAULT_TREE_CHILD_PAGE)} more of {row.hidden}
            </button>
          )
        }
        const { node, depth } = row
        const dir = node.type === 'directory'
        const open = dir && isOpen(node.path)
        const selected = !dir && node.path === selectedPath
        const active = dir && node.path === activeFolder
        const kind = dir ? { Icon: open ? FolderOpen : Folder, ink: 'text-muted-foreground' } : fileKind(node.name)
        const Icon = kind.Icon
        const change = dir ? (open ? undefined : changedFolders.get(node.path)) : status?.[node.path]
        const ancestors: string[] = []
        for (let at = row.parent; at; at = index.parents.get(at) ?? null) ancestors.unshift(at)
        return (
          <div
            key={node.path}
            ref={(element) => {
              if (element) {
                rowRefs.current.set(node.path, element)
                if (arrivals.has(node.path)) animatedPaths.current.add(node.path)
                if (pendingFocusRef.current === node.path) { pendingFocusRef.current = null; element.focus({ preventScroll: true }) }
                if (target === node.path && rows.length <= 100) revealInScroller(element)
              } else rowRefs.current.delete(node.path)
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-posinset={row.posInSet}
            aria-setsize={row.setSize}
            aria-expanded={dir ? open : undefined}
            aria-selected={dir ? undefined : selected}
            aria-current={active ? 'true' : undefined}
            tabIndex={node.path === tabStop ? 0 : -1}
            title={node.path}
            data-vault-tree-item={node.type}
            data-path={node.path}
            data-selected={selected ? 'true' : undefined}
            onClick={() => activate(node)}
            onFocus={() => setFocusedPath(node.path)}
            onKeyDown={(event) => onKeyDown(event, node)}
            style={{ paddingInlineStart: depth * INDENT + 4 }}
            className={[
              'group relative flex min-h-8 w-full cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-sm transition-colors [@media(pointer:coarse)]:min-h-10',
              arrivals.has(node.path) && !animatedPaths.current.has(node.path) ? 'agent-arrive' : '',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected
                ? 'bg-[var(--ix-sel-bg)] font-medium text-[var(--accent-text)]'
                : active
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-foreground hover:bg-[var(--ix-hover-bg)]',
            ].join(' ')}
          >
            {ancestors.map((folder, level) => (
              <span
                key={folder}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 w-px ${folder === openParent ? 'bg-[var(--border-strong)]' : 'bg-border'}`}
                style={{ left: level * INDENT + 12 }}
              />
            ))}
            <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
              {dir && <ChevronRight className={`size-3.5 transition-transform duration-fast ${open ? 'rotate-90' : ''}`} />}
            </span>
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${kind.ink}`} />
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            {change && (dir
              ? <span aria-label={`holds ${change === 'added' ? 'added' : 'changed'} files`} className={`size-1.5 shrink-0 rounded-full ${change === 'added' ? 'bg-[var(--surface-success-text)]' : 'bg-[var(--surface-warning-text)]'}`} />
              : <span aria-label={change} className={`w-3.5 shrink-0 text-center font-mono text-xs font-semibold ${CHANGE[change].ink}`}>{CHANGE[change].letter}</span>)}
          </div>
        )
  }
  return <div ref={element => {
    treeRef.current = element
    if (!element) return
    let parent = element?.parentElement ?? null
    while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
    scroller.current = parent ?? document.scrollingElement as HTMLElement
  }} role="tree" aria-label={label} data-vault-tree-rows className={className}>
    <VirtualList items={rows} keyOf={keyOf} render={render} scroller={scroller} origin={treeRef} estimate={33} overscan={320} target={target} targetAlign="nearest" virtualize={rows.length > 100} keepMounted={tabStop ?? undefined} />
  </div>
}
