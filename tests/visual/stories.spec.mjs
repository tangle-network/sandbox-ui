import { readFileSync } from 'node:fs'
import { test, expect } from 'playwright/test'

const index = JSON.parse(readFileSync(new URL('../../storybook-static/index.json', import.meta.url)))
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story')
const themes = ['dark', 'light']
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

test('catalog contains stories', () => {
  expect(stories.length).toBeGreaterThan(0)
})

for (const story of stories) {
  for (const theme of themes) {
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      test(`${story.id} ${theme} ${viewportName}`, async ({ page }) => {
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.clock.install({ time: new Date('2026-09-23T12:00:00Z') })
        await page.setViewportSize(viewport)
        await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=sandboxTheme:${theme}`, {
          waitUntil: 'load',
        })
        await expect(page.locator('#storybook-root')).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#storybook-root img')).every((img) => {
          const rect = img.getBoundingClientRect()
          const visible = rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0
          return !visible || (img.complete && img.naturalWidth > 0)
        }))
        if (/^workbench-changespane--(default|many-files|commit-failed|committing)$/.test(story.id)) {
          await page.waitForFunction(() => document.querySelector('[data-testid="diff-view"] diffs-container')?.shadowRoot?.textContent?.includes('RetryOptions'))
        }
        if (story.id.startsWith('workflows-')) {
          await expect(page.locator('.react-flow__node').first()).toBeVisible()
          await expect(page.getByText('Loading graph...')).toHaveCount(0)
          await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          }))
        }
        expect(errors).toEqual([])
        await expect(page).toHaveScreenshot(`${story.id}-${theme}-${viewportName}.png`, {
          fullPage: false,
        })
      })
    }
  }
}
