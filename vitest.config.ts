import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
    include: process.env.SANDBOX_UI_BRIDGE === "1"
      ? ["tests/integration/bridge.test.mjs"]
      : ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
})
