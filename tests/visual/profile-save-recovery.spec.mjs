import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })

for (const theme of ['light', 'dark']) {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    test(`profile save retains a rejected draft and retries on ${device} ${theme}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'chat-agentprofilepicker--save-recovery', theme, viewport, baseURL)
      await page.getByRole('button', { name: 'Agent profile', exact: true }).click()
      await page.getByRole('button', { name: /New agent/ }).click()
      const name = page.getByPlaceholder('Agent name (e.g. Tax Reviewer)')
      const instructions = page.getByPlaceholder(/Instructions \(optional\)/)
      await name.fill('Keep my draft')
      await instructions.fill('Do not lose these instructions.')
      const save = page.getByRole('button', { name: 'Save agent', exact: true })
      await save.focus()
      await save.press('Enter')
      await expect(page.getByRole('button', { name: 'Saving agent…', exact: true })).toBeDisabled()
      await expect(name).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
      await expect(page.getByRole('status')).toHaveText('Save attempts: 1')
      await page.screenshot({ path: info.outputPath(`profile-save-pending-${device}-${theme}.png`), animations: 'disabled' })

      await page.getByRole('button', { name: 'Reject pending save', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Your draft is still here')
      await expect(name).toHaveValue('Keep my draft')
      await expect(instructions).toHaveValue('Do not lose these instructions.')
      await expect(save).toBeEnabled()
      await page.screenshot({ path: info.outputPath(`profile-save-error-${device}-${theme}.png`), animations: 'disabled' })

      await save.focus()
      await save.press('Enter')
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByRole('status')).toHaveText('Save attempts: 2')
      await page.getByRole('button', { name: 'Confirm pending save', exact: true }).click()
      await expect(name).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Agent profile', exact: true })).toContainText('Keep my draft')
    })
  }
}
