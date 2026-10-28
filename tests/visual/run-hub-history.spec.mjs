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

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) test(`bounded hub keeps every agent and its details reachable ${theme} ${width}`, async ({ page, baseURL }) => {
  await openStory(page, 'workflows-agentgraph-hub--unreported-history', theme, { width, height: 900 }, baseURL)
  await page.locator('.ag-root').evaluate(element => { element.style.height = '320px' })
  const wrap = page.locator('.ag-canvas-wrap'), seen = new Set()
  await expect(page.locator('.ag-node')).toHaveCount(5)
  const box = await wrap.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let step = 0; step < 4; step++) {
    for (const id of await wrap.evaluate(element => {
      const frame = element.getBoundingClientRect()
      return [...element.querySelectorAll('.ag-node')].filter(node => { const tile = node.querySelector('.ag-tile').getBoundingClientRect(); return tile.top >= frame.top && tile.bottom <= frame.bottom }).map(node => node.dataset.agentGraphNode)
    })) seen.add(id)
    await page.mouse.wheel(0, 220)
    await page.waitForTimeout(80)
  }
  expect(await wrap.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect([...seen].sort()).toEqual(['analyst', 'coder', 'orch', 'research', 'writer'])
  await page.locator('[data-agent-graph-node="analyst"]').click()
  const dialog = page.getByRole('dialog', { name: 'Analyst calls' })
  await expect.poll(async () => { const popup = await dialog.boundingBox(), frame = await wrap.boundingBox(); return popup !== null && popup.y >= frame.y && popup.y + popup.height <= frame.y + frame.height }).toBe(true)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('[data-agent-graph-node="analyst"]')).toBeFocused()
  await assertStoryHealthy(page)
})
