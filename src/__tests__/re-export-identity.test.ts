import { describe, expect, test } from "vitest";

import { Button as B1 } from "@tangle-network/sandbox-ui/primitives";
import { Button as B2 } from "@tangle-network/ui/primitives";
import { ChatMessage as C1 } from "@tangle-network/sandbox-ui/chat";
import { ChatMessage as C2 } from "@tangle-network/ui/chat";
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

const cases: ReadonlyArray<readonly [string, unknown, unknown, "function" | "object"]> = [
  ["primitives.Button", B1, B2, "function"],
  ["chat.ChatMessage", C1, C2, "function"],
  ["run.RunGroup", R1, R2, "function"],
  ["openui.OpenUIArtifactRenderer", O1, O2, "function"],
  ["files.FileTree", F1, F2, "function"],
  ["editor.TiptapEditor", E1, E2, "function"],
  ["markdown.Markdown", M1, M2, "function"],
  ["auth.GitHubLoginButton", A1, A2, "function"],
  ["utils.cn", U1, U2, "function"],
  ["hooks.useAutoScroll", H1, H2, "function"],
  ["sdk-hooks.useSdkSession", SK1, SK2, "function"],
  ["stores.activeSessionsAtom", ST1, ST2, "object"],
  ["tool-previews.CommandPreview (via root)", TP1, TP2, "function"],
];

describe("re-export bridge identity", () => {
  for (const [name, fromBridge, fromUi, expectedType] of cases) {
    test(`${name} forwards to @tangle-network/ui`, () => {
      expect(typeof fromUi).toBe(expectedType);
      expect(fromBridge).toBe(fromUi);
    });
  }
});
