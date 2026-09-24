import { defineConfig, devices } from 'playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  reporter: process.env.CI ? 'dot' : 'list',
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6006',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 6006 --bind 127.0.0.1 --directory storybook-static',
    url: 'http://127.0.0.1:6006/index.json',
    reuseExistingServer: !process.env.CI,
    stderr: 'ignore',
    timeout: 120_000,
  },
})
