// The existing format producer and callbacks must fit the built public component.
import type { RecordEvent, RecordNode, RunRecord } from "@drewstone/agent-record/record";
import { Conversation, indexRecord, withPrompts, ToolStep, type ConversationProps } from "../dist/run/record.js";

declare const retained: RunRecord;
declare const openSource: (sha: string, event: RecordEvent) => void;
const index = indexRecord(withPrompts(retained));
const node: RecordNode | undefined = index.nodes.get("retained");
const actors: readonly RecordNode[] = index.actors;
void [node, actors];
// Emitting this consumer declaration must be able to name every exposed type.
export const producerIndex = (record: RunRecord) => indexRecord(withPrompts(record));
const props: ConversationProps = {
  index, actor: retained.nodes[0]!.id,
  cutoff: Infinity, query: "", category: "all", openSource,
};
export const consumer = <Conversation {...props} />;

// A canonical timeline tool may carry only its public call; its ToolPart is optional.
export const toolWithoutPart = <ToolStep item={{ id: "public-tool", kind: "tool", call: { id: "public-tool", type: "bash", label: "Shell", status: "success" } }} />;
