import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

test.use({ video: 'on' })

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

test('workflow panel sizes to the loop and draws every label at 11px or more', async ({ page, baseURL }) => {
  await openStory(page, 'workflows-templates--platform-panel', 'dark', { width: 800, height: 900 }, baseURL)
  const loop = page.locator('.wf-graph').first()
  await expect(loop).toHaveAttribute('data-layout', 'ready')
  const labels = () => loop.evaluate(graph => {
    const zoom = new DOMMatrix(getComputedStyle(graph.querySelector('.react-flow__viewport')).transform).a
    return [...graph.querySelectorAll('.react-flow__nodes *, .react-flow__edgelabel-renderer *')]
      .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
      .map(el => ({ text: el.textContent, px: parseFloat(getComputedStyle(el).fontSize) * zoom, cut: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 }))
  })
  await expect.poll(async () => (await labels()).filter(label => label.px < 11)).toEqual([])
  expect((await labels()).find(label => label.text.includes('VERDICT: revise'))).toMatchObject({ cut: false })
  expect((await loop.boundingBox()).height).toBeLessThan(640)
  await assertStoryHealthy(page)
})
