import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) for (const [story, tools, calls] of [
  ['unreported-history', '— tools', '— calls/min'], ['empty-history', '0 tools', '0 calls/min'], ['no-calls', '6 tools', '0 calls/min'],
]) test(`hub preserves missing history ${story} ${theme} ${width}`, async ({ page, baseURL }, info) => {
  await openStory(page, `workflows-agentgraph-hub--${story}`, theme, { width, height: 900 }, baseURL)
  const stats = page.locator('.ag-stats > span')
  await expect(stats.nth(1)).toHaveText(tools)
  await expect(stats.nth(2)).toHaveText(calls)
  if (story === 'unreported-history') {
    await expect(stats.nth(1)).toHaveAttribute('title', /not reported/i)
    await expect(stats.nth(2)).toHaveAttribute('title', /not reported/i)
  }
  await page.screenshot({ path: info.outputPath('hub-history.png') })
  await assertStoryHealthy(page)
})
