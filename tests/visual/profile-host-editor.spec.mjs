import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })

for (const theme of ['light', 'dark']) {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    test(`host profile editor remains discoverable on ${device} ${theme}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'chat-agentprofilepicker--host-editor', theme, viewport, baseURL)
      const trigger = page.getByRole('button', { name: 'Agent profile', exact: true })
      await trigger.click()
      const edit = page.getByTitle('Edit', { exact: true }).first()
      await edit.focus()
      await expect(edit.locator('..')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: info.outputPath(`profile-host-edit-${device}-${theme}.png`), animations: 'disabled' })
      await edit.press('Enter')
      await expect(page.getByTestId('agent-profile-popover')).toHaveCount(0)
      const editor = page.getByRole('dialog', { name: 'Host profile editor' })
      await expect(editor).toContainText('assistant')
      await editor.getByRole('button', { name: 'Close editor' }).click()
      await trigger.click()
      await page.getByRole('button', { name: 'New agent…', exact: true }).click()
      await expect(editor).toContainText('new')
      await expect(page.getByTestId('agent-profile-popover')).toHaveCount(0)
    })
  }
}
