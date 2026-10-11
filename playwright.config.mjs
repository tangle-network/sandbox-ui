import { defineConfig, devices } from 'playwright/test'

// Serve the static build on its own port and never reuse a running server: a
// Storybook dev server, or another checkout's build, would render a different tree.
// A random free-range port unless one is given: concurrent gates on one Beelink all
// claimed 6106 and the second one's server never started. Set on process.env so the
// workers Playwright spawns after loading this config read the same port.
process.env.STORYBOOK_PORT ??= String(20000 + Math.floor(Math.random() * 20000))
const storybookPort = Number(process.env.STORYBOOK_PORT)

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: true,
  updateSnapshots: 'none',
  reporter: process.env.CI ? 'dot' : 'list',
  // A Beelink runs several gates at once; one worker per two cores starves story
  // readiness past 30 s. CI and every other host use the same 4.
  workers: 4,
  // One retry absorbs readiness timeouts on a saturated shared host. Pixel
  // comparisons are deterministic, so a real visual change still fails twice;
  // the report lists any retried test as flaky.
  retries: 1,
  // Generous ceilings: a shared Linux host under load slows rendering, not pixels.
  timeout: 60_000,
  expect: {
    // A screenshot needs two identical frames; a loaded host missed that inside 15 s for
    // a random handful of stories per run.
    timeout: 30_000,
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
    reuseExistingServer: false,
    stderr: 'ignore',
    timeout: 120_000,
  },
})
