import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) {
  test(`selected agent remains within resized viewport ${theme} ${width}`, async ({ page, baseURL }, info) => {
    const viewport = { width, height: width === 390 ? 844 : 900 }
    await openStory(page, 'workflows-agentgraph--seventeen-live', theme, viewport, baseURL, { reducedMotion: 'no-preference' })
    await expect(page.locator('.agent-graph[data-layout="ready"], .agent-graph[data-layout="list"]')).toBeVisible()
    await expect(page.getByLabel('Run status')).toContainText('17 agents')
    expect(await page.locator('.react-flow__node-liveAgent, .ag-phone-select').count()).toBeLessThanOrEqual(17)
    if (width === 1280) expect(await page.locator('.react-flow__viewport').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThanOrEqual(1)
    await info.attach('initial-seventeen-overview', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await assertStoryHealthy(page)
    await openStory(page, 'run-traceworkspace--timeline-and-graph', theme, viewport, baseURL, { reducedMotion: 'no-preference' })
    await page.getByRole('radio', { name: 'Graph', exact: true }).click()
    await expect(page.locator('.agent-graph[data-layout="ready"], .agent-graph[data-layout="list"]')).toBeVisible()
    await page.clock.setSystemTime(new Date('2026-09-23T12:00:00Z'))
    const clockStart = await page.evaluate(() => Date.now())
    await page.waitForTimeout(3500)
    expect(await page.evaluate(() => Date.now()), 'Exercise the advancing live clock').toBeGreaterThan(clockStart + 3000)
    const positions = () => page.locator('.react-flow__node-agent, .react-flow__node-liveAgent').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.id, node.style.transform])))
    const before = await positions()
    await page.locator('.react-flow__node-agent, .react-flow__node-liveAgent, .ag-phone-select').filter({ hasText: 'verifier' }).click()
    await expect(page.getByRole('complementary', { name: 'verifier conversation' })).toBeVisible()
    await page.waitForTimeout(1100)
    await page.waitForFunction(() => {
      const graph = document.querySelector('.ag-graph-viewport')
      const key = graph.clientWidth + ':' + graph.clientHeight
      window.__graphStable = window.__graphSize === key ? (window.__graphStable ?? 0) + 1 : 0
      window.__graphSize = key
      return window.__graphStable >= 3
    }, null, { polling: 100 })
    const readBounds = () => page.evaluate(() => {
      const viewport = document.querySelector('.ag-graph-viewport').getBoundingClientRect()
      const selected = document.querySelector('.react-flow__node[aria-pressed="true"], .ag-phone-select[aria-pressed="true"]').getBoundingClientRect()
      const rect = r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height })
      return { viewport: rect(viewport), selected: rect(selected), within: selected.left >= viewport.left - 1 && selected.right <= viewport.right + 1 && selected.top >= viewport.top - 1 && selected.bottom <= viewport.bottom + 1 }
    })
    if (width === 1280) {
      const initial = await readBounds()
      const shift = initial.viewport.right - 8 - initial.selected.right
      await page.mouse.move(initial.viewport.left + 6, initial.viewport.bottom - 6)
      await page.mouse.down()
      await page.mouse.move(initial.viewport.left + 6 + shift, initial.viewport.bottom - 6, { steps: 8 })
      await page.mouse.up()
      await expect.poll(async () => Math.abs((await readBounds()).selected.right - initial.viewport.right + 8)).toBeLessThan(4)
      await page.setViewportSize({ width: 1240, height: viewport.height })
      await page.waitForTimeout(500)
      const resized = await readBounds()
      await info.attach('narrowed-selected-bounds', { body: JSON.stringify(resized), contentType: 'application/json' })
      await info.attach('narrowed-selected', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      expect.soft(resized.within, 'A reader pan followed by resize must keep the selected card visible').toBe(true)
      await page.setViewportSize(viewport)
      await page.waitForTimeout(500)
    }
    const bounds = await readBounds()
    const after = await positions()
    await info.attach('selected-bounds', { body: JSON.stringify({ theme, width, bounds, before, after }), contentType: 'application/json' })
    await info.attach('selected-with-conversation', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    expect.soft(bounds.within, JSON.stringify(bounds)).toBe(true)
    expect.soft(after, 'A viewport resize must not change graph positions').toEqual(before)
    await assertStoryHealthy(page)
    await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Steps', exact: true })).toBeVisible()
    await info.attach('conversation-closed', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
