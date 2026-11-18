import { useRef, useState } from "react";
import { VirtualList } from "@tangle-network/sandbox-ui/run/record";
import { AgentGraph } from "@tangle-network/sandbox-ui/workflows";

const agent = { id: "run-live", label: "Recorded agent" };

export function VirtualListConsumer() {
  const scroller = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(500), [target, setTarget] = useState<string>();
  const items = Array.from({ length: count }, (_, id) => ({ id: `source:${id}`, label: `Source entry ${id}` }));
  return <section data-virtual-list-consumer style={{ margin: 16 }}>
    <button type="button" onClick={() => { setCount(value => value + 50); setTarget(`source:${count + 49}`); }}>Append retained entries</button>
    <div ref={scroller} role="list" tabIndex={0} aria-label="Retained source entries" style={{ height: 160, overflow: "auto" }}>
      <VirtualList items={items} keyOf={item => item.id} scroller={scroller} target={target} estimate={28}
        render={item => <div role="listitem" data-source-entry={item.id} style={{ height: 20 + Number(item.id.split(":")[1]) % 7 * 12, marginBottom: 8 }}>{item.label}</div>} />
    </div>
  </section>;
}

export function RecordTopologyConsumer() {
  const [selectedId, onSelect] = useState<string>();
  return <section data-record-topology data-agent-id={agent.id} style={{ margin: 16 }}>
    <output aria-label="Topology selection">{selectedId}</output>
    <div style={{ height: 360 }}>
      <AgentGraph nodes={[{ id: agent.id, label: agent.label ?? agent.id, status: "unknown" }]} edges={[]}
        selectedId={selectedId} onSelect={onSelect} live className="h-full" />
    </div>
  </section>;
}
