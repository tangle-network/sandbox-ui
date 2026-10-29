import { useMemo, type ReactNode } from 'react'
import { RunStatusIcon, runStatus } from '@tangle-network/ui/run'
import { ms, roleOf, type RecordIndex } from './model.js'
import type { ConversationNode } from './types.js'

type TreeEntry = { node: ConversationNode; children: TreeEntry[] }

/** Retained identity and recorded time define the hierarchy; labels never join sessions or invent parents. */
export function AgentTree({ index, actor, cutoff, select }: {
  index: RecordIndex; actor: string; cutoff: number; select: (id: string) => void
}) {
  const roots = useMemo(() => {
    const nodes = index.actors.filter(node => node.kind !== 'finding')
    const byId = new Map(nodes.map(node => [node.id, node]))
    const children = new Map<string, ConversationNode[]>()
    for (const node of nodes) {
      if (!node.parent) continue
      const parent = index.canonical(node.parent), siblings = children.get(parent) ?? []
      siblings.push(node); children.set(parent, siblings)
    }
    const visited = new Set<string>()
    const visit = (node: ConversationNode): TreeEntry[] => {
      if (visited.has(node.id)) return []
      visited.add(node.id)
      return [{ node, children: (children.get(node.id) ?? []).flatMap(visit) }]
    }
    const roots = nodes.filter(node => !node.parent || !byId.has(index.canonical(node.parent))).flatMap(visit)
    // A malformed/cyclic attribution still retains every actor once.
    for (const node of nodes) roots.push(...visit(node))
    return roots
  }, [index])
  const renderNodes = (entries: readonly TreeEntry[], nested = false): ReactNode => (
    <ul className={nested ? 'm-0 ml-3 list-none border-l border-border pl-2' : 'm-0 grid list-none gap-1 p-0'}>
      {entries.map(({ node, children }) => {
        const firstEvent = index.byActor.get(node.id)?.[0]
        const begin = node.start ? ms(node.start) : firstEvent ? ms(firstEvent.at) : undefined
        const end = typeof node.end === 'string' ? node.end : undefined
        const future = begin !== undefined && begin > cutoff, ended = end !== undefined && ms(end) <= cutoff
        const state = future ? 'Not yet started' : ended ? node.status === 'done' ? 'Finished' : node.status === 'down' ? 'Stopped' : node.status ?? 'Ended' : end ? 'Not yet settled' : 'No terminal record'
        return <li className="min-w-0" key={node.id}>
          <button type="button"
            className="flex w-full min-w-0 items-start gap-2 rounded border border-transparent px-2 py-1.5 text-left text-sm text-foreground hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-border aria-pressed:bg-muted data-[future]:opacity-55"
            aria-label={'Read ' + roleOf(node) + ' ' + node.label + ' conversation. ' + state + '.'}
            aria-pressed={actor === node.id} data-node={node.id} data-future={future ? '' : undefined}
            title={node.label + (node.assignment ? ' · ' + node.assignment : '') + ' · ' + state}
            onClick={() => select(node.id)}>
            <RunStatusIcon status={runStatus(future ? 'unknown' : node.status === 'down' || node.status === 'no-winner' ? 'stopped' : node.status ?? 'unknown')} className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="grid min-w-0 gap-0.5 break-words">
              <span className="font-semibold">{node.label}</span>
              <span className="text-muted-foreground">{roleOf(node)} · {state}</span>
            </span>
          </button>
          {children.length > 0 && renderNodes(children, true)}
        </li>
      })}
    </ul>
  )
  return <div className="record-agent-tree max-h-80 overflow-auto px-2 py-2" data-graph role="group" aria-label="Recorded agent hierarchy. Select an agent to read its conversation.">
    {roots.length ? renderNodes(roots) : <p className="text-sm text-muted-foreground">No agent topology was retained.</p>}
  </div>
}
