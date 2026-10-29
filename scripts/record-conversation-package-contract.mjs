import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The retained conversation must render from the installed tarball, without agent-record installed. */
export async function validateRecordConversation({ root, consumerDir }) {
  const require = createRequire(join(consumerDir, "package.json"));
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { Conversation, indexRecord } = await import(pathToFileURL(require.resolve("@tangle-network/sandbox-ui/run")));
  assert.throws(() => require.resolve("@drewstone/agent-record/record"), /MODULE_NOT_FOUND/);
  const record = JSON.parse(readFileSync(join(root, "src/run/record/__fixtures__/live-conversation.json"), "utf8"));
  const html = renderToStaticMarkup(createElement(Conversation, {
    index: indexRecord(record), actor: "run-live", cutoff: Infinity, query: "", category: "all",
  }));
  assert.match(html, /waited 20s · 5 polls · tokens unknown/);
  assert.match(html, /data-poll-group="5"/);
  assert.match(html, /args not captured/);
  assert.match(html, /Result not captured/);
  assert.match(html, /thinking not returned by provider/);
  assert.match(html, /2 thinking blocks redacted \(encrypted\)/);
  assert.equal(html.match(/max-w-5xl/g)?.length, 1);
  assert.ok((html.match(/data-timeline-step=/g)?.length ?? 0) > 3);
  assert.match(readFileSync(require.resolve("@tangle-network/sandbox-ui/styles.css"), "utf8"), /\.record-conversation/);
  console.log("Packed retained transcript renders without a record parser dependency");
}
