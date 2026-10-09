import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })

const viewports = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
// sm:p-2 on desktop, p-1.5 on a phone, plus the surface's 1px border.
const gutter = { desktop: 9, phone: 7 }

for (const theme of ['light', 'dark']) {
  for (const [name, viewport] of Object.entries(viewports)) {
    test(`inset surface reaches the edge with its toggle in the header ${theme} ${name}`, async ({ page, baseURL }) => {
      await openStory(page, 'workspace-workspacelayout--inset-surface', theme, viewport, baseURL)
      const surface = page.locator('[data-workspace-surface]')
      const header = page.locator('[data-workspace-header="center"]')
      const toggle = page.getByRole('button', { name: 'Open workspace tools' })
      await expect(toggle).toBeVisible()

      const surfaceBox = await surface.boundingBox()
      expect(viewport.width - (surfaceBox.x + surfaceBox.width), 'surface right edge stays within the gutter').toBeLessThanOrEqual(gutter[name])
      expect(surfaceBox.y, 'top gutter matches the side gutter').toBeLessThanOrEqual(gutter[name])

      const headerBox = await header.boundingBox()
      const toggleBox = await toggle.boundingBox()
      expect(toggleBox.x).toBeGreaterThanOrEqual(headerBox.x)
      expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width)
      expect(toggleBox.y).toBeGreaterThanOrEqual(headerBox.y)
      expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height)
      expect(headerBox.x + headerBox.width - (toggleBox.x + toggleBox.width), 'toggle sits in the top-right corner').toBeLessThanOrEqual(12)
      expect(toggleBox.width).toBeGreaterThanOrEqual(32)

      // A closed panel leaves no element painted with its surface.
      await expect(page.locator('[data-workspace-pane="right"]')).toHaveCount(0)
      await expect(page.getByRole('complementary')).toHaveCount(0)

      await toggle.focus()
      await expect(page.getByRole('tooltip')).toContainText('Files, Agent, Terminal')
      await page.keyboard.press('Enter')
      if (name === 'desktop') {
        const pane = page.locator('[data-workspace-pane="right"]')
        await expect(pane).toBeVisible()
        const paneHeaderBox = await pane.locator(':scope > div').first().boundingBox()
        const openHeaderBox = await header.boundingBox()
        expect(Math.abs(paneHeaderBox.y - openHeaderBox.y)).toBeLessThanOrEqual(1)
        expect(Math.abs(paneHeaderBox.height - openHeaderBox.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(viewport.width - ((await surface.boundingBox()).x + (await surface.boundingBox()).width))).toBeLessThanOrEqual(gutter[name])
        await page.getByRole('button', { name: 'Close workspace tools' }).click()
      } else {
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.keyboard.press('Escape')
      }
      await expect(toggle).toBeFocused()
    })
  }
}
