import * as root from "@tangle-network/sandbox-ui";
import * as primitives from "@tangle-network/sandbox-ui/primitives";
import * as ui from "@tangle-network/ui/primitives";
import * as utils from "@tangle-network/sandbox-ui/utils";
import * as canonicalUtils from "@tangle-network/ui/utils";

import * as chat from "@tangle-network/sandbox-ui/chat";
import * as canonicalChat from "@tangle-network/ui/chat";
import * as run from "@tangle-network/sandbox-ui/run";
import * as canonicalRun from "@tangle-network/ui/run";
import * as openui from "@tangle-network/sandbox-ui/openui";
import * as canonicalOpenui from "@tangle-network/ui/openui";
import * as files from "@tangle-network/sandbox-ui/files";
import * as canonicalFiles from "@tangle-network/ui/files";
import * as editor from "@tangle-network/sandbox-ui/editor";
import * as canonicalEditor from "@tangle-network/ui/editor";
import * as markdown from "@tangle-network/sandbox-ui/markdown";
import * as canonicalMarkdown from "@tangle-network/ui/markdown";
import * as auth from "@tangle-network/sandbox-ui/auth";
import * as canonicalAuth from "@tangle-network/ui/auth";
import * as hooks from "@tangle-network/sandbox-ui/hooks";
import * as canonicalHooks from "@tangle-network/ui/hooks";
import * as sdkHooks from "@tangle-network/sandbox-ui/sdk-hooks";
import * as canonicalSdkHooks from "@tangle-network/ui/sdk-hooks";
import * as stores from "@tangle-network/sandbox-ui/stores";
import * as canonicalStores from "@tangle-network/ui/stores";
import { CommandPreview } from "@tangle-network/ui/tool-previews";

function match(actual, expected, names, entry) {
  for (const name of names) {
    if (expected[name] === undefined || actual[name] !== expected[name]) {
      throw new Error('Packed ' + entry + '.' + name + ' must forward its canonical UI binding');
    }
  }
}

match(primitives, ui, Object.keys(ui).filter(name => name !== "Logo" && name !== "TangleKnot"), "primitives");
match(root, ui, [
  "Heading", "PageHeader", "PageShell", "Card", "CardHeader", "CardContent",
  "CardFooter", "CardDescription", "CardTitle", "Table", "TableHeader",
  "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption",
  "StatusPill", "Tag", "Chip", "IconTile", "toneFor",
  "Button", "Input", "Textarea", "SelectTrigger", "Label", "HelpText",
  "Field", "fieldMessageId", "SettingsList", "SettingsListItem", "SettingsRow", "SettingsSection",
  "Calendar", "DatePicker", "TimeSelect", "RadioGroup", "RadioGroupItem",
  "TerminalLine",
], "root");
match(root, { TerminalDisplayLine: ui.TerminalLine }, ["TerminalDisplayLine"], "root");
match(utils, canonicalUtils, Object.keys(canonicalUtils), "utils");
match(root, canonicalUtils, Object.keys(canonicalUtils), "root");

const entries = [
  ["chat", chat, canonicalChat, ["ChatMessage", "MessageAuthor", "isViewerMessage"]],
  ["run", run, canonicalRun, ["RunGroup"]],
  ["openui", openui, canonicalOpenui, ["OpenUIArtifactRenderer"]],
  ["files", files, canonicalFiles, ["FileTree", "PdfViewer", "configurePdfViewer", "FileCard", "FileList"], ["PdfViewer"]],
  ["editor", editor, canonicalEditor, ["TiptapEditor"]],
  ["markdown", markdown, canonicalMarkdown, ["Markdown", "CopyButton", "getSanitizedMarkdownHeadingIdFromRawFragment"], ["getSanitizedMarkdownHeadingIdFromRawFragment"]],
  ["auth", auth, canonicalAuth, ["GitHubLoginButton"]],
  ["hooks", hooks, canonicalHooks, ["useAutoScroll", "useRunNow"], ["useRunNow"]],
  ["sdk-hooks", sdkHooks, canonicalSdkHooks, ["useSdkSession"]],
  ["stores", stores, canonicalStores, ["activeSessionsAtom"]],
];
for (const [entry, bridge, canonical, names, rootNames] of entries) {
  match(bridge, canonical, names, entry);
  if (rootNames) match(root, canonical, rootNames, "root");
}
match(root, { CommandPreview }, ["CommandPreview"], "root");
