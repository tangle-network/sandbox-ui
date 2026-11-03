import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: {
    // The bridge-identity tests import this package's own public entries; resolve them to the source so a test
    // run never depends on a stale dist/ build (five bridge assertions failed against a weeks-old dist, #524).
    alias: [{ find: /^@tangle-network\/sandbox-ui(\/.*)?$/, replacement: resolve(__dirname, "src$1") }],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
})
