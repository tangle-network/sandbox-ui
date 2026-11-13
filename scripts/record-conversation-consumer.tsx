import { useMemo, useRef, useState } from "react";
import { Conversation, VirtualList, VirtualCommand, indexRecord, withPrompts, type ConversationRecord } from "@tangle-network/sandbox-ui/run/record";
import { Button } from "@tangle-network/ui/primitives";
import "@tangle-network/ui/styles/command.css";
import retained from "./record-conversation.json";
import { HarnessLogo } from "@tangle-network/sandbox-ui/dashboard";
import { AgentGraph } from "@tangle-network/sandbox-ui/workflows";

const record: ConversationRecord = structuredClone(retained);
const agent = record.nodes[0]!;
agent.assignment = "Reconstructed duplicate must not appear";
record.nodes.push({ ...agent, id: "linked-session", kind: "session", agentId: agent.id });
for (const event of record.events) event.node = "linked-session";
const result = record.events.find(event => event.detail.toolCallId === "201")!;
result.detail.clip = { bytes: 4_000_001, sha256: "a".repeat(64) };
record.events.push({ ...structuredClone(result), id: "standalone-result", at: "2026-10-05T06:01:00.000Z", detail: { ...result.detail, toolCallId: "unpaired", clip: { bytes: 5_000_001, sha256: "b".repeat(64) } } });
record.events.push({ ...structuredClone(record.events[0]!), id: "follow-up", at: "2026-10-05T06:01:01.000Z", detail: { role: "user", publicText: "Retained follow-up", nativeRecordId: "follow-up" } });
const prompted = withPrompts(record);
const initial = prompted.events.filter(event => event.detail.promptKind === "initial");
const steering = prompted.events.filter(event => event.detail.promptKind === "steering");
if (initial.length !== 1 || steering.length !== 1 || initial[0]!.id.startsWith("prompt:")) throw new Error("Linked session prompts were not retained/classified");

export function RecordConversationConsumer() {
  const [source, setSource] = useState(""), [category, setCategory] = useState("all"), [arrivals, append] = useState(0);
  const index = indexRecord({ ...prompted, events: [...prompted.events, ...Array.from({ length: arrivals }, (_, i) => ({ id: `arrival-${i}`, node: "linked-session", kind: "message", category: "other", label: "Agent", at: new Date(Date.parse("2026-10-05T06:01:02Z") + i * 1000).toISOString(), detail: { role: "assistant", publicText: `Live turn ${i + 1}` } }))] });
  return <section data-record-conversation data-initial-prompts={initial.length} data-steering-prompts={steering.length} style={{ margin: 16, minWidth: 0 }}>
    <aside data-record-harness-logos>{["opencode", "claude-code", "codex", "glm", "kimi", "grok"].map(type => <HarnessLogo key={type} type={type} model="Recorded model" size={28} />)}</aside>
    <button type="button" onClick={() => setCategory(category === "all" ? "prompts" : "all")}>Filter retained prompts</button>
    <output data-source-open={source} style={{ overflowWrap: "anywhere" }}>{source}</output>
    <button type="button" onClick={() => { setCategory("all"); append(value => value + 1); }}>Append live turn</button>
    <Conversation key={arrivals ? "live" : "recorded"} live={arrivals > 0} index={index} actor={agent.id} selected={arrivals ? undefined : category === "all" ? "standalone-result" : "follow-up"} cutoff={Infinity} query="" category={category} openSource={(sha, event) => setSource(`${sha}:${event.id}`)} />
  </section>;
}
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

/** Actual installed command/virtualizer; the URL is the consumer's committed selection. */
export function VirtualCommandConsumer() {
  const initial = new URLSearchParams(location.search)
  const [size, setSize] = useState(Number(initial.get('choice-count')) || 122)
  const [many, setMany] = useState(false), [removed, setRemoved] = useState(''), [disabled, setDisabled] = useState('')
  const [value, setValue] = useState(initial.get('choice') ?? 'choice:0121'), [commits, setCommits] = useState(0)
  const key = (at: number) => `choice:${String(at).padStart(4, '0')}`
  const route = (next: string, count = size) => {
    const url = new URL(location.href); url.searchParams.set('choice', next); url.searchParams.set('choice-count', String(count))
    history.replaceState(null, '', url); setValue(next)
  }
  const choices = useMemo(() => Array.from({ length: size }, (_, at) => ({
    value: key(at), label: at === 7 || at === 8 ? 'Twin label' : `Recorded choice ${String(at).padStart(4, '0')}`,
    group: many ? { value: `group:${at}`, label: `Group ${at}` } : { value: at < size / 2 ? 'A' : 'B', label: at < size / 2 ? 'Group A' : 'Group B' },
    disabled: at === 3 || key(at) === disabled,
  })).filter(item => item.value !== removed), [size, many, removed, disabled])
  const configure = (count: number, grouped = false) => {
    setSize(count); setMany(grouped); setRemoved(''); setDisabled(''); route(key(count - 1), count)
  }
  return <section data-virtual-command-consumer style={{ margin: 16 }}>
    <h2>Recorded choices</h2>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button onClick={() => configure(122)}>Use 122 choices</Button>
      <Button onClick={() => configure(1000)}>Use 1000 choices</Button>
      <Button onClick={() => configure(1000, true)}>Use 1000 groups</Button>
      <Button onClick={() => setTimeout(() => setRemoved(value), 2000)}>Remove current after opening</Button>
      <Button onClick={() => setTimeout(() => setDisabled(value), 2000)}>Disable current after opening</Button>
    </div>
    <output aria-label="Committed choice">{value}</output>
    <output aria-label="Choice commits">{commits}</output>
    <output aria-label="Removed choice">{removed}</output>
    <output aria-label="Disabled choice">{disabled}</output>
    <VirtualCommand items={choices} value={value} onSelect={next => { setCommits(count => count + 1); route(next) }}
      label="Find recorded choice" listLabel="Recorded choices" trigger={<Button>Choose recorded item</Button>} />
  </section>
}
