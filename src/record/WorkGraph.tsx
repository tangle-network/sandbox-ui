import { useMemo, useRef, useState } from 'react'
import { useColorMode } from '@tangle-network/charts/react/agent-graph/presentation'
import { Controls, Handle, MarkerType, Position, ReactFlow, type NodeProps } from '@xyflow/react'
import { recordWorkGraphModel, NODE_W, NODE_H, PER_LANE, type GraphNode, type RunRecord } from '@drewstone/agent-record/record'

function RecordCard({ data }: NodeProps) {
  const node = data.record as GraphNode
  return <div title={node.title} className={`graph-node kind-${node.kind}`}>
    <Handle type="target" position={Position.Left} className="opacity-0" />
    <span className="graph-node-title">{node.title}</span><span className="graph-node-sub">{node.sub}</span>
    <Handle type="source" position={Position.Right} className="opacity-0" />
  </div>
}
const nodeTypes = { record: RecordCard }
/** Recorded evidence relationships keep their domain kinds; the maintained graph engine owns the camera and focus. */
export function RecordWorkGraph({ record }: { record: RunRecord }) {
  const graph = useMemo(() => recordWorkGraphModel(record), [record])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const colorMode = useColorMode(wrapperRef, graph.nodes.length > 0)
  const [selected, setSelected] = useState<string | null>(null)
  const chosen = selected ? graph.byId.get(selected) : undefined
  const adjacent = new Set(chosen ? [chosen.id, ...graph.edges.filter(edge => edge.from === chosen.id || edge.to === chosen.id).flatMap(edge => [edge.from, edge.to])] : [])
  const nodes = useMemo(() => graph.nodes.map(node => ({ id: node.id, type: 'record', position: { x: node.x, y: node.y }, data: { record: node }, width: NODE_W, height: NODE_H, ariaLabel: `${node.kind}: ${node.title}`, domAttributes: { 'data-graph-node-id': node.id, 'data-graph-node-kind': node.kind, 'aria-pressed': node.id === selected }, selected: node.id === selected, style: { opacity: selected && !adjacent.has(node.id) ? 0.35 : 1 } })), [graph, selected])
  const edges = useMemo(() => graph.edges.map((edge, i) => ({ id: String(i), source: edge.from, target: edge.to, label: edge.kind, markerEnd: { type: MarkerType.ArrowClosed }, className: `edge-${edge.kind}`, style: { opacity: selected && edge.from !== selected && edge.to !== selected ? 0.2 : 1 }, data: { kind: edge.kind } })), [graph, selected])
  return <div ref={wrapperRef} className="agent-record ar-ws"><section className="work-graph" aria-label={graph.title} data-work-graph={graph.nodes.length} data-graph-kind="record">
    <div className="graph-main"><header className="graph-head"><h2>{graph.title}</h2><span className="faint">{graph.summary}</span></header>
      <div className="graph-viewport" style={{ height: 560 }} onKeyDownCapture={event => {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.react-flow__node[data-id]') : null
        const from = target?.dataset.id ? graph.byId.get(target.dataset.id) : undefined
        if (!from) return
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSelected(selected === from.id ? null : from.id); return }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight', sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
        const score = (node: GraphNode) => horizontal ? Math.abs(node.y - from.y) * 4 + Math.abs(node.x - from.x) : Math.abs(node.x - from.x) * 4 + Math.abs(node.y - from.y)
        const next = graph.nodes.filter(node => node.id !== from.id && (horizontal ? node.x - from.x : node.y - from.y) * sign > 0).sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0]
        if (next) { event.preventDefault(); event.stopPropagation(); event.currentTarget.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(next.id)}"]`)?.focus() }
      }}>
        <ReactFlow colorMode={colorMode} key={record.runId} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false} nodesConnectable={false} minZoom={0.12} maxZoom={2}
          onNodeClick={(_, node) => setSelected(selected === node.id ? null : node.id)} onPaneClick={() => setSelected(null)}>
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {Object.keys(graph.hidden).length > 0 && <p className="faint">Each lane shows its first {PER_LANE} results, claims and checks; {Object.values(graph.hidden).reduce((a, b) => a + b, 0)} more are retained in the record.</p>}
      <ul className="graph-legend">{graph.legend.map(entry => <li key={entry.kind}>{entry.label}</li>)}</ul>
    </div>
    <aside className="graph-side finding-card" aria-label="Selected card">{chosen ? <><h3>{chosen.kind}</h3><div className="graph-side-title">{chosen.title}</div><div className="faint">{chosen.sub}</div>{chosen.summary && <p>{chosen.summary}</p>}
      <div className="faint">{graph.edges.filter(edge => edge.from === chosen.id).length} links out · {graph.edges.filter(edge => edge.to === chosen.id).length} links in</div>
      {chosen.href && <a href={chosen.href} target="_blank" rel="noopener noreferrer">Open source ↗</a>}</> : <p className="faint">Select a card to see its recorded relationships and details.</p>}
    </aside>
  </section></div>
}
