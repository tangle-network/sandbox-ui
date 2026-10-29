import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['light', 'dark']) for (const width of [1512, 390]) {
  test(`101 agents retain reading size, context and complete metrics ${theme} ${width}`, async ({ page, baseURL }, info) => {
    await openStory(page, 'workflows-agentgraph--hundred-workers', theme, { width, height: 982 }, baseURL)
    const graph = page.locator('.agent-graph')
    await expect(graph).toHaveAttribute('data-layout', width === 390 ? 'list' : 'ready')
    const cards = page.locator('.react-flow__node-liveAgent, .ag-phone-select')
    expect(await cards.count()).toBeLessThan(100)
    if (width === 1512) {
      const scale = () => page.locator('.react-flow__viewport').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
      expect(await scale()).toBeGreaterThanOrEqual(1)
      await expect(page.getByRole('img', { name: 'Agent topology overview' })).toBeVisible()
      await page.getByRole('button', { name: 'Collapse root team', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Expand root team', exact: true })).toBeVisible()
      await expect(page.locator('.react-flow__node-liveAgent')).toHaveCount(1)
    } else {
      await expect(page.getByLabel('Agent pages')).toContainText('1–24 of 101')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(page.getByLabel('Agent pages')).toContainText('25–48 of 101')
    }
    await page.getByRole('button', { name: 'Select last agent', exact: true }).click()
    const selected = page.locator(width === 390 ? '[data-agent-id="worker-99"]' : '.react-flow__node[data-id="worker-99"]')
    await expect(selected).toBeVisible()
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
    if (width === 1512) {
      await selected.hover()
      const metrics = page.getByRole('tooltip')
      for (const text of ['Input', '24,000 tokens', 'Output', '12,000 tokens', 'Cached', '87,456 tokens', 'Tool calls', '36 · bash 24 · read 12', 'Latency p50 / p90 / p99', '12 s / 24 s / 36 s', 'Failures / retries', '2 / 1']) await expect(metrics).toContainText(text)
      await metrics.hover()
      await page.mouse.wheel(0, 1600)
      await expect.poll(() => metrics.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      await expect(metrics.getByText('Recorded tool 40', { exact: true })).toBeInViewport()
      await page.mouse.move(0, 0)
    }
    await page.keyboard.press('Tab')
    await selected.focus()
    await expect(page.getByRole('tooltip')).toContainText('24,000 tokens')
    await selected.press('Tab')
    await expect(page.getByRole('tooltip')).toBeFocused()
    await page.getByRole('tooltip').press('End')
    await expect(page.getByRole('tooltip').getByText('Recorded tool 40', { exact: true })).toBeInViewport()
    await page.getByRole('tooltip').press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await assertStoryHealthy(page)
    await info.attach(`101-agents-${theme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
