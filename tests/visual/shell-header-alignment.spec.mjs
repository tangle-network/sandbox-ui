import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })

// Bottom edge of an element's bottom border, in CSS px.
async function dividerY(locator) {
  return locator.evaluate((node) => node.getBoundingClientRect().bottom)
}

const stories = {
  inset: 'dashboard-sidebarlayout--shell-header-alignment',
  page: 'dashboard-sidebarlayout--shell-header-alignment-page',
}

for (const theme of ['light', 'dark']) {
  for (const [kind, id] of Object.entries(stories)) {
    test(`main header divider continues the rail's first divider ${kind} ${theme} desktop`, async ({ page, baseURL }) => {
      await openStory(page, id, theme, { width: 1440, height: 900 }, baseURL)
      const rail = page.locator('[data-shell-header]').filter({ visible: true }).first()
      const railY = await dividerY(rail)
      expect(railY, 'rail header is the shell header height').toBeCloseTo(56, 0)
      const main = kind === 'inset'
        ? [page.locator('[data-workspace-header="center"]'), page.locator('[data-workspace-pane="right"] [data-shell-header]')]
        : [page.getByTestId('page-header')]
      for (const header of main) {
        await expect(header).toBeVisible()
        expect(Math.abs((await dividerY(header)) - railY), 'divider offset from the rail, px').toBeLessThanOrEqual(0.5)
      }
    })

    test(`phone bar and main header rows keep the shell height ${kind} ${theme} phone`, async ({ page, baseURL }) => {
      await openStory(page, id, theme, { width: 390, height: 844 }, baseURL)
      const bar = page.locator('header[data-shell-header]').filter({ visible: true }).first()
      expect(await dividerY(bar)).toBeCloseTo(56, 0)
      if (kind === 'page') {
        // Below the bar, the page header starts at 56 and is exactly one row tall.
        const header = page.getByTestId('page-header')
        const box = await header.boundingBox()
        expect(box.height).toBeCloseTo(56, 0)
      }
    })
  }
}
