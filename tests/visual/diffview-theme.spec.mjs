import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory, waitForDiffRender } from './story-ready.mjs'

test.afterEach(async ({ page }) => {
  await assertStoryHealthy(page)
})

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

for (const theme of ['light', 'dark']) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    test(`DiffView renderer follows ${theme} app theme on ${viewportName}`, async ({ page, baseURL }) => {
      await openStory(page, `workbench-diffview--${theme}-theme`, theme, viewport, baseURL)
      await waitForDiffRender(page, 'retryDelay')

      const renderer = page.locator('[data-testid="diff-view"] diffs-container')
      const colors = await renderer.evaluate((element) => {
        const style = getComputedStyle(element)
        return { background: style.backgroundColor, colorScheme: style.colorScheme }
      })
      expect(colors).toEqual({
        background: theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 41, 46)',
        colorScheme: theme,
      })
    })
  }
}
