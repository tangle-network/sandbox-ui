import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) test(`wrapped hub header keeps every metric above its canvas ${theme} ${width}`, async ({ page, baseURL }, info) => {
  await openStory(page, 'workflows-agentgraph-hub--bounded-attention', theme, { width, height: 900 }, baseURL)
  const bounds = await page.locator('.ag-root').evaluate(element => {
    const rect = selector => { const r = element.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom } }
    return { head: rect('.ag-head'), canvas: rect('.ag-canvas-wrap'), metrics: [...element.querySelectorAll('.ag-stats > span')].map(node => { const r = node.getBoundingClientRect(); return { text: node.textContent, top: r.top, bottom: r.bottom } }) }
  })
  await page.screenshot({ path: info.outputPath('hub-header.png') })
  expect(bounds.metrics).toHaveLength(4)
  for (const metric of bounds.metrics) {
    expect(metric.top).toBeGreaterThanOrEqual(bounds.head.top)
    expect(metric.bottom).toBeLessThanOrEqual(bounds.head.bottom + 1)
    expect(metric.bottom).toBeLessThanOrEqual(bounds.canvas.top)
  }
  await assertStoryHealthy(page)
})
