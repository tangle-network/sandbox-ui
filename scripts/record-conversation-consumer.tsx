import { useState } from "react";
import { Conversation, indexRecord, withPrompts, type ConversationRecord } from "@tangle-network/sandbox-ui/run/record";
import retained from "./record-conversation.json";

// Use the retained capture with linked-session and clipped-result boundary variants.
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
const index = indexRecord(prompted);
const initial = prompted.events.filter(event => event.detail.promptKind === "initial");
const steering = prompted.events.filter(event => event.detail.promptKind === "steering");
if (initial.length !== 1 || steering.length !== 1 || initial[0]!.id.startsWith("prompt:")) throw new Error("Linked session prompts were not retained/classified");

export function RecordConversationConsumer() {
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("all");
  return <section data-record-conversation data-initial-prompts={initial.length} data-steering-prompts={steering.length} style={{ margin: 16, minWidth: 0 }}>
    <button type="button" onClick={() => setCategory(category === "all" ? "prompts" : "all")}>Filter retained prompts</button>
    <output data-source-open={source} style={{ overflowWrap: "anywhere" }}>{source}</output>
    <Conversation index={index} actor={agent.id} selected={category === "all" ? "standalone-result" : "follow-up"} cutoff={Infinity} query="" category={category} openSource={(sha, event) => setSource(`${sha}:${event.id}`)} />
  </section>;
}
