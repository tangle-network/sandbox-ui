import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

for (const theme of ['light', 'dark']) {
  for (const [size, viewport] of Object.entries({
    mobile: { width: 390, height: 844 },
    desktop: { width: 1365, height: 900 },
  })) {
    test(`long runtime menu scrolls and selects in ${theme} ${size}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'dashboard-backendselector--long-catalog', theme, viewport, baseURL)
      const trigger = page.getByRole('combobox')
      await trigger.click()
      const menu = page.getByRole('listbox')
      await expect(menu).toBeVisible()
      await expect.poll(async () => {
        const rect = await menu.boundingBox()
        return rect && rect.y >= 0 && rect.y + rect.height <= viewport.height
      }).toBe(true)
      const scroll = page.locator('[data-radix-select-viewport]')
      expect(await scroll.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
      await scroll.hover()
      await page.mouse.wheel(0, 1500)
      await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
      await page.getByRole('option', { name: /^Runtime 12\b/ }).click()
      await expect(trigger).toContainText('Runtime 12')
      await expect(trigger).toBeFocused()
      await trigger.press('ArrowDown')
      await page.keyboard.press('Home')
      await page.keyboard.press('Enter')
      await expect(trigger).toContainText('Runtime 1')
      await trigger.click()
      await page.screenshot({ path: info.outputPath(`runtime-menu-${theme}-${size}.png`) })
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
      await assertStoryHealthy(page)
    })

    test(`existing harness picker selects in ${theme} ${size}`, async ({ page, baseURL }) => {
      await openStory(page, 'dashboard-harnesspicker--default', theme, viewport, baseURL)
      const trigger = page.getByRole('combobox')
      await trigger.click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await expect(trigger).toBeFocused()
      await expect(page.getByRole('listbox')).toHaveCount(0)
      await assertStoryHealthy(page)
    })
  }
}
