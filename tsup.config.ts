import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    primitives: "src/primitives/index.ts",
    chat: "src/chat/index.ts",
    workflows: "src/workflows/index.ts",
    run: "src/run/index.ts",
    workspace: "src/workspace/index.ts",
    workbench: "src/workbench/index.ts",
    openui: "src/openui/index.ts",
    files: "src/files/index.ts",
    dashboard: "src/dashboard/index.ts",
    editor: "src/editor/index.ts",
    terminal: "src/terminal/index.ts",
    markdown: "src/markdown/index.ts",
    auth: "src/auth/index.ts",
    integrations: "src/integrations/index.ts",
    connectors: "src/connectors/index.ts",
    pages: "src/pages/index.ts",
    hooks: "src/hooks/index.ts",
    "sdk-hooks": "src/sdk-hooks.ts",
    stores: "src/stores/index.ts",
    types: "src/types/index.ts",
    utils: "src/utils/index.ts",
    assets: "src/assets/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  noExternal: ["@lobehub/icons-static-svg"],
  onSuccess: "node scripts/copy-styles.mjs",
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.loader = {
      ...options.loader,
      ".svg": "dataurl",
    };
  },
});
