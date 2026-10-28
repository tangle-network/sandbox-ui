import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) for (const [story, tools, calls] of [
  ['unreported-history', '— tools', '— calls/min'], ['empty-history', '0 tools', '0 calls/min'], ['no-calls', '6 tools', '0 calls/min'],
]) test(`hub preserves missing history ${story} ${theme} ${width}`, async ({ page, baseURL }, info) => {
  await openStory(page, `workflows-agentgraph-hub--${story}`, theme, { width, height: 900 }, baseURL)
  const stats = page.locator('.ag-stats > span')
  expect.soft(await stats.nth(1).innerText()).toBe(tools)
  expect.soft(await stats.nth(2).innerText()).toBe(calls)
  await page.getByRole('button', { name: /^Orchestrator,/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Orchestrator calls' })
  expect.soft(await dialog.locator('.ag-pop-foot').innerText()).toContain(`${story === 'unreported-history' ? '—' : '0'} calls in the last minute`)
  if (story === 'unreported-history') {
    await expect(stats.nth(1)).toHaveAttribute('title', /not reported/i, { timeout: 2000 })
    await expect(stats.nth(2)).toHaveAttribute('title', /not reported/i, { timeout: 2000 })
  }
  await page.screenshot({ path: info.outputPath('hub-history.png') })
  await assertStoryHealthy(page)
})
