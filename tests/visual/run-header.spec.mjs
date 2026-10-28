import { test, expect } from 'playwright/test'
import { writeFileSync } from 'node:fs'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['dark', 'light']) for (const width of [1280, 884, 390, 320]) test(`run header retains every attention count ${theme} ${width}`, async ({ page, baseURL }, testInfo) => {
  await openStory(page, 'workflows-agentgraph--live-failed-long', theme, { width, height: 900 }, baseURL)
  const header = page.getByLabel('Run status', { exact: true })
  const geometry = await header.evaluate(element => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
    return { header: rect(element), agents: rect(element.firstElementChild), counts: [...element.querySelectorAll('.ag-status-button')].map(button => ({ button: rect(button), count: rect(button.firstElementChild) })) }
  })
  writeFileSync(testInfo.outputPath('header-geometry.json'), JSON.stringify({ theme, width, ...geometry }, null, 2))
  await page.screenshot({ path: testInfo.outputPath('header.png') })
  for (const { button, count } of geometry.counts) {
    expect(count.left).toBeGreaterThanOrEqual(button.left - 1)
    expect(count.right).toBeLessThanOrEqual(button.right + 1)
    expect(button.left).toBeGreaterThanOrEqual(geometry.header.left - 1)
    expect(button.right).toBeLessThanOrEqual(geometry.header.right + 1)
  }
  expect(geometry.agents.bottom - geometry.agents.top).toBeLessThanOrEqual(20)
  await expect(header).toContainText('1 needs you')
  await expect(header).toContainText('2 failed')
  await expect(header).toContainText('1 quiet')
  await assertStoryHealthy(page)
})
