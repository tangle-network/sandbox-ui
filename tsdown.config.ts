import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    primitives: "src/primitives/index.ts",
    chat: "src/chat/index.ts",
    workflows: "src/workflows/index.ts",
    run: "src/run/index.ts",
    "run/record": "src/run/record/index.ts",
    "run/live": "src/run/live.tsx",
    workspace: "src/workspace/index.ts",
    workbench: "src/workbench/index.ts",
    "workbench/embedded-app": "src/workbench/embedded-app.ts",
    "workbench/diff": "src/workbench/diff.ts",
    openui: "src/openui/index.ts",
    files: "src/files/index.ts",
    "vault-tree": "src/vault-tree/index.ts",
    dashboard: "src/dashboard/index.ts",
    editor: "src/editor/index.ts",
    terminal: "src/terminal/index.ts",
    markdown: "src/markdown/index.ts",
    auth: "src/auth/index.ts",
    integrations: "src/integrations/index.ts",
    connections: "src/connections/index.ts",
    connectors: "src/connectors/index.ts",
    pages: "src/pages/index.ts",
    hooks: "src/hooks/index.ts",
    "hooks/use-document": "src/hooks/use-document.ts",
    "sdk-hooks": "src/sdk-hooks.ts",
    stores: "src/stores/index.ts",
    types: "src/types/index.ts",
    utils: "src/utils/index.ts",
    assets: "src/assets/index.ts",
  },
  format: ["esm"],
  platform: "neutral",
  // The grapheme addon publishes module/main entries without an exports map.
  inputOptions: { resolve: { mainFields: ["module", "main"] } },
  dts: true,
  clean: true,
  fixedExtension: false,
  // Provider logos ship inside the bundle as data URLs, so consumers need no
  // asset loader for them.
  deps: {
    alwaysBundle: [
      /^@lobehub\/icons-static-svg\//,
      // Keep terminal-only assets out of embedded-app consumers' dependencies.
      /^@xterm\/addon-unicode-graphemes$/,
    ],
  },
  loader: { ".svg": "dataurl" },
  onSuccess: "node scripts/copy-styles.mjs && node scripts/build-runtime-viewer.mjs",
  // Bundling drops per-file "use client" directives, as tsup did before.
  // Consumers mark their own client boundaries.
  checks: { moduleLevelDirective: false },
});
