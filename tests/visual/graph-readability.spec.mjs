import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

test.use({ video: 'on' })

for (const theme of ['light', 'dark']) for (const width of [1512, 390]) {
  test(`101 agents retain reading size, context and complete metrics ${theme} ${width}`, async ({ page, baseURL }, info) => {
    await openStory(page, 'workflows-agentgraph--hundred-workers', theme, { width, height: 982 }, baseURL)
    const graph = page.locator('.agent-graph')
    await expect(graph).toHaveAttribute('data-layout', width === 390 ? 'list' : 'ready')
    const cards = page.locator('.react-flow__node-liveAgent, .ag-phone-select')
    expect(await cards.count()).toBeLessThan(100)
    await page.screenshot({ path: info.outputPath(`initial-${theme}-${width}.png`) })
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
      await expect(page.locator('.ag-phone-select').first()).toBeInViewport()
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
      await page.screenshot({ path: info.outputPath(`full-metrics-${theme}-${width}.png`) })
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
    const screenshot = info.outputPath(`101-agents-${theme}-${width}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    await info.attach(`101-agents-${theme}-${width}`, { path: screenshot, contentType: 'image/png' })
    // A portal must carry the graph's scoped tokens across an opposite document theme.
    await graph.evaluate((el, theme) => { document.documentElement.dataset.theme = theme === 'light' ? 'dark' : 'light'; document.documentElement.style.colorScheme = theme === 'light' ? 'dark' : 'light'; el.dataset.theme = theme; el.style.colorScheme = theme }, theme)
    await page.keyboard.press('Tab')
    await selected.focus()
    const expected = await graph.evaluate(el => { const probe = document.createElement('span'); probe.className = 'shadow-xl'; probe.style.cssText = 'color:hsl(var(--foreground));background-color:hsl(var(--card))'; el.append(probe); const css = getComputedStyle(probe), colors = { color: css.color, backgroundColor: css.backgroundColor, boxShadow: css.boxShadow }; probe.remove(); return colors })
    await expect.poll(() => page.getByRole('tooltip').evaluate(el => { const css = getComputedStyle(el); return { color: css.color, backgroundColor: css.backgroundColor, boxShadow: css.boxShadow } })).toEqual(expected)
    await expect(page.getByRole('tooltip')).toHaveAttribute('data-theme', theme)
    await page.screenshot({ path: info.outputPath(`scoped-${theme}-${width}.png`) })
    await selected.press('Escape')

  })
}

for (const theme of ['light', 'dark']) for (const [story, count] of [['seventeen-agents', 17], ['nested-teams', 8], ['nested-teams-left-to-right', 8]]) {
  test(`initial selected worker retains the whole readable graph ${story} ${theme}`, async ({ page, baseURL }, info) => {
    await openStory(page, `workflows-agentgraph--${story}`, theme, { width: 1512, height: 982 }, baseURL)
    await expect(page.locator('.agent-graph')).toHaveAttribute('data-layout', 'ready')
    await expect(page.locator('.react-flow__node-agent')).toHaveCount(count)
    await expect.poll(() => page.evaluate(() => {
      const view = document.querySelector('.ag-graph-viewport').getBoundingClientRect()
      return [...document.querySelectorAll('.react-flow__node-agent')].filter(node => { const box = node.getBoundingClientRect(); return box.left < view.left - 1 || box.right > view.right + 1 || box.top < view.top - 1 || box.bottom > view.bottom + 1 }).length
    })).toBe(0)
    expect(await page.locator('.react-flow__viewport').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(1)
    await assertStoryHealthy(page)
    await page.screenshot({ path: info.outputPath(`selected-${story}-${theme}.png`) })
  })
}
