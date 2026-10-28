import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

for (const story of ['live-run-cards', 'burst']) {
  test(`motion snapshot replay holds ${story} at zero`, async ({ page, baseURL }, testInfo) => {
    await openStory(page, `workflows-agentgraph--${story}`, 'light', { width: 390, height: 844 }, baseURL)
    await expect(page.locator('.agent-graph')).toHaveAttribute('data-layout', 'list')
    const contents = await page.locator('.agent-graph').evaluate(root => new Promise(resolve => {
      const states = new Set([root.innerText])
      const observer = new MutationObserver(() => states.add(root.innerText))
      observer.observe(root, { subtree: true, childList: true, characterData: true })
      setTimeout(() => { observer.disconnect(); resolve([...states]) }, 2500)
    }))
    expect(contents).toHaveLength(1)
    await assertStoryHealthy(page)
    await testInfo.attach('replay', { body: JSON.stringify({ story, url: page.url(), contents }), contentType: 'application/json' })
  })
}

test('raw Burst keeps seventeen rendered agents streaming at three ticks per second', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--burst&viewMode=story&globals=sandboxTheme:dark')
  await expect(page.locator('.agent-graph')).toHaveAttribute('data-layout', 'ready')
  await expect(page.locator('.ag-live-card')).toHaveCount(17)
  const metrics = await page.evaluate(() => new Promise(resolve => {
    const fixture = document.querySelector('[data-story-tick]')
    const cards = [...document.querySelectorAll('.ag-live-card')]
    const tails = cards.map(card => card.querySelector('ol').textContent)
    const changed = new Set()
    const observer = new MutationObserver(() => cards.forEach((card, i) => {
      if (card.querySelector('ol').textContent !== tails[i]) changed.add(i)
    }))
    observer.observe(fixture, { subtree: true, childList: true, characterData: true })
    const started = performance.now(), startTick = Number(fixture.dataset.storyTick)
    setTimeout(() => {
      observer.disconnect()
      const seconds = (performance.now() - started) / 1000
      const ticks = Number(fixture.dataset.storyTick) - startTick
      resolve({ seconds, ticks, ticksPerSecond: ticks / seconds, agents: cards.length, changedTails: changed.size, events: cards.length * ticks })
    }, 3000)
  }))
  expect(new URL(page.url()).searchParams.has('args')).toBe(false)
  expect(metrics.agents).toBe(17)
  expect(metrics.changedTails).toBe(17)
  expect(metrics.ticksPerSecond).toBeGreaterThanOrEqual(2.5)
  expect(metrics.ticksPerSecond).toBeLessThanOrEqual(3.5)
  await testInfo.attach('stream-throughput', { body: JSON.stringify(metrics), contentType: 'application/json' })
  console.log(JSON.stringify({ kind: 'raw-burst-throughput', ...metrics }))
})
