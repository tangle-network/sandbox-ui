import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

for (const theme of ['dark', 'light']) {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    test(`retained pane ${theme} ${name}`, async ({ page, baseURL }) => {
      await openStory(page, 'workspace-workspacelayout--retained-companion', theme, viewport, baseURL)
      await page.getByRole('button', { name: 'Open right panel' }).click()
      const input = page.getByRole('textbox', { name: 'Terminal input' })
      await input.fill('Retain this draft across pane changes')
      await expect(page).toHaveScreenshot(`retained-pane-${theme}-${name}.png`)
      if (name === 'mobile') {
        await input.press('Escape')
      } else {
        await page.getByRole('button', { name: 'Collapse right panel' }).click()
      }
      const reopen = page.getByRole('button', { name: 'Open right panel' })
      await expect(reopen).toBeFocused()
      await reopen.press('Enter')
      await expect(input).toHaveValue('Retain this draft across pane changes')
      await page.setViewportSize(name === 'desktop' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
      await expect(input).toBeVisible()
      await expect(input).toHaveValue('Retain this draft across pane changes')
      await assertStoryHealthy(page)
    })
  }
}
