import { defineConfig } from "playwright/test"

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
} as const

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  updateSnapshots: "none",
  outputDir: "test-results/ui-visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/ui-visual", open: "never" }]],
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0, threshold: 0.1 } },
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:6006",
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(viewports).flatMap(([size, viewport]) =>
    (["light", "dark"] as const).map((theme) => ({
      name: `${size}-${theme}`,
      metadata: { sandboxTheme: theme },
      use: { viewport, colorScheme: theme },
    })),
  ),
  webServer: {
    command: "pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6006 --strictPort",
    url: "http://127.0.0.1:6006/index.json",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
