import { describe, expect, test } from "vitest";

import { Button as B1 } from "@tangle-network/sandbox-ui/primitives";
import { Button as B2 } from "@tangle-network/ui/primitives";
import { ChatMessage as C1 } from "@tangle-network/sandbox-ui/chat";
import { ChatMessage as C2 } from "@tangle-network/ui/chat";
import { MessageAuthor as MA1, isViewerMessage as IV1 } from "@tangle-network/sandbox-ui/chat";
import { MessageAuthor as MA2, isViewerMessage as IV2 } from "@tangle-network/ui/chat";
import { RunGroup as R1 } from "@tangle-network/sandbox-ui/run";
import { RunGroup as R2 } from "@tangle-network/ui/run";
import { OpenUIArtifactRenderer as O1 } from "@tangle-network/sandbox-ui/openui";
import { OpenUIArtifactRenderer as O2 } from "@tangle-network/ui/openui";
import { FileTree as F1 } from "@tangle-network/sandbox-ui/files";
import { FileTree as F2 } from "@tangle-network/ui/files";
import { TiptapEditor as E1 } from "@tangle-network/sandbox-ui/editor";
import { TiptapEditor as E2 } from "@tangle-network/ui/editor";
import { Markdown as M1 } from "@tangle-network/sandbox-ui/markdown";
import { Markdown as M2 } from "@tangle-network/ui/markdown";
import { getSanitizedMarkdownHeadingIdFromRawFragment as MH1 } from "@tangle-network/sandbox-ui/markdown";
import { getSanitizedMarkdownHeadingIdFromRawFragment as MH2 } from "@tangle-network/ui/markdown";
import { getSanitizedMarkdownHeadingIdFromRawFragment as MHR } from "@tangle-network/sandbox-ui";
import { GitHubLoginButton as A1 } from "@tangle-network/sandbox-ui/auth";
import { GitHubLoginButton as A2 } from "@tangle-network/ui/auth";
import { cn as U1 } from "@tangle-network/sandbox-ui/utils";
import { cn as U2 } from "@tangle-network/ui/utils";
import { useAutoScroll as H1 } from "@tangle-network/sandbox-ui/hooks";
import { useAutoScroll as H2 } from "@tangle-network/ui/hooks";
import { useSdkSession as SK1 } from "@tangle-network/sandbox-ui/sdk-hooks";
import { useSdkSession as SK2 } from "@tangle-network/ui/sdk-hooks";
import { activeSessionsAtom as ST1 } from "@tangle-network/sandbox-ui/stores";
import { activeSessionsAtom as ST2 } from "@tangle-network/ui/stores";
import { CommandPreview as TP1 } from "@tangle-network/sandbox-ui";
import { CommandPreview as TP2 } from "@tangle-network/ui/tool-previews";

import * as sandboxPrimitives from "@tangle-network/sandbox-ui/primitives";
import * as sandboxRoot from "@tangle-network/sandbox-ui";
import * as canonicalPrimitives from "@tangle-network/ui/primitives";

const presentationNames = [
  "Heading", "PageHeader", "PageShell", "Card", "CardHeader", "CardContent",
  "CardFooter", "CardDescription", "CardTitle", "Table", "TableHeader",
  "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption",
  "StatusPill", "Tag", "Chip", "IconTile", "toneFor",
] as const;

const cases: ReadonlyArray<readonly [string, unknown, unknown]> = [
  ...presentationNames.flatMap((name) => [
    [`primitives.${name}`, sandboxPrimitives[name], canonicalPrimitives[name]] as const,
    [`root.${name}`, sandboxRoot[name], canonicalPrimitives[name]] as const,
  ]),
  ["primitives.Button", B1, B2],
  ["chat.ChatMessage", C1, C2],
  ["chat.MessageAuthor", MA1, MA2],
  ["chat.isViewerMessage", IV1, IV2],
  ["run.RunGroup", R1, R2],
  ["openui.OpenUIArtifactRenderer", O1, O2],
  ["files.FileTree", F1, F2],
  ["editor.TiptapEditor", E1, E2],
  ["markdown.Markdown", M1, M2],
  ["markdown.getSanitizedMarkdownHeadingIdFromRawFragment", MH1, MH2],
  ["root.getSanitizedMarkdownHeadingIdFromRawFragment", MHR, MH2],
  ["auth.GitHubLoginButton", A1, A2],
  ["utils.cn", U1, U2],
  ["hooks.useAutoScroll", H1, H2],
  ["sdk-hooks.useSdkSession", SK1, SK2],
  ["stores.activeSessionsAtom", ST1, ST2],
  ["tool-previews.CommandPreview (via root)", TP1, TP2],
];

describe("re-export bridge identity", () => {
  for (const [name, fromBridge, fromUi] of cases) {
    test(`${name} forwards to @tangle-network/ui`, () => {
      expect(fromUi).toBeDefined();
      expect(fromBridge).toBe(fromUi);
    });
  }
});
