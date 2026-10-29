// The existing format producer and callbacks must fit the built public component.
import type { RecordEvent, RunRecord } from "@drewstone/agent-record/record";
import { Conversation, indexRecord, withPrompts, type ConversationProps } from "../dist/run.js";

declare const retained: RunRecord;
declare const openSource: (sha: string, event: RecordEvent) => void;
const props: ConversationProps = {
  index: indexRecord(withPrompts(retained)), actor: retained.nodes[0]!.id,
  cutoff: Infinity, query: "", category: "all", openSource,
};
export const consumer = <Conversation {...props} />;
