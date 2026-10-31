import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** Import the installed ESM tarball as a real consumer, with no parser dependency. */
export function validateRecordConversation({ root, consumerDir }) {
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createRequire } from "node:module";
    import { readFileSync } from "node:fs";
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { Conversation, indexRecord, ToolStep } from "@tangle-network/sandbox-ui/run/record";
    const simpleTool = renderToStaticMarkup(createElement(ToolStep, { item: { id: "public-tool", kind: "tool", call: { id: "public-tool", type: "bash", label: "Shell", status: "success" } } }));
    assert.match(simpleTool, /data-timeline-step="tool"/);
    assert.match(simpleTool, /Shell/);
    const require = createRequire(import.meta.url);
    if (JSON.parse(process.env.PACKAGE_OMIT_OPTIONAL_PEERS ?? "[]").includes("@drewstone/agent-record")) {
      assert.throws(() => require.resolve("@drewstone/agent-record/record"), { code: "MODULE_NOT_FOUND" });
    }
    const record = JSON.parse(readFileSync(process.env.RECORD_CONVERSATION_FIXTURE, "utf8"));
    const html = renderToStaticMarkup(createElement(Conversation, {
      index: indexRecord(record), actor: "run-live", cutoff: Infinity, query: "", category: "all",
    }));
    assert.match(html, /waited 20s · 5 polls · tokens unknown/);
    assert.match(html, /data-poll-group="5"/);
    assert.match(html, /args not captured/);
    assert.match(html, /Result not captured/);
    assert.match(html, /thinking not returned by provider/);
    assert.match(html, /2 thinking blocks redacted \\(encrypted\\)/);
    assert.equal(html.match(/max-w-5xl/g)?.length, 1);
    assert.ok((html.match(/data-timeline-step=/g)?.length ?? 0) > 3);
    assert.match(readFileSync(new URL(import.meta.resolve("@tangle-network/sandbox-ui/styles")), "utf8"), /\\.record-conversation/);
    console.log("Packed retained transcript renders without a record parser dependency");
  `], {
    cwd: consumerDir, stdio: "inherit",
    env: { ...process.env, RECORD_CONVERSATION_FIXTURE: join(root, "src/run/record/__fixtures__/live-conversation.json") },
  });
}
