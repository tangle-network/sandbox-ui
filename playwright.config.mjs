import { defineConfig, devices } from 'playwright/test'

const storybookPort = Number(process.env.STORYBOOK_PORT ?? 6006)

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: true,
  updateSnapshots: 'none',
  reporter: process.env.CI ? 'dot' : 'list',
  workers: process.env.CI ? 4 : undefined,
  retries: 0,
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
    baseURL: `http://127.0.0.1:${storybookPort}`,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    // Playwright's blocker throws inside the PreviewView frame without allow-same-origin.
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `python3 -m http.server ${storybookPort} --bind 127.0.0.1 --directory storybook-static`,
    url: `http://127.0.0.1:${storybookPort}/index.json`,
    reuseExistingServer: !process.env.CI,
    stderr: 'ignore',
    timeout: 120_000,
  },
})
