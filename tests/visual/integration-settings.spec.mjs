import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })
for (const theme of ['light', 'dark']) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`settings geometry ${theme} ${viewport.width}`, async ({ page, baseURL }, testInfo) => {
      await openStory(page, 'integrations-settings--geometry', theme, viewport, baseURL)
      const frame = page.getByRole('region', { name: 'Agent access' })
      const before = await frame.boundingBox()
      const search = page.getByRole('textbox', { name: 'Search integrations' })
      await search.focus()
      await search.evaluate((element) => { element.dataset.retained = 'yes' })
      await page.getByRole('button', { name: 'loaded', exact: true }).click()
      const loaded = await frame.boundingBox()
      expect(Math.abs(loaded.width - before.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(loaded.height - before.height)).toBeLessThanOrEqual(1)
      await expect(search).toHaveAttribute('data-retained', 'yes')
      for (const state of ['empty', 'error', 'loading']) {
        await page.getByRole('button', { name: state, exact: true }).click()
        expect(Math.abs((await frame.boundingBox()).width - before.width)).toBeLessThanOrEqual(1)
        await expect(search).toHaveAttribute('data-retained', 'yes')
        await expect(page.getByRole('button', { name: /Request an integration/ })).toHaveCount(0)
      }
      await page.getByRole('button', { name: 'loaded', exact: true }).click()
      await testInfo.attach(`catalog-${theme}-${viewport.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    })
    test(`settings accounts and details ${theme} ${viewport.width}`, async ({ page, baseURL }, testInfo) => {
      await openStory(page, `integrations-settings--catalog-${theme}`, theme, viewport, baseURL)
      const selector = page.getByRole('combobox', { name: 'Account for Slack' })
      await expect(selector).toHaveValue('')
      await expect(page.getByTestId('manage-slack')).toHaveCount(0)
      await selector.selectOption('team/two')
      await expect(page.getByTestId('manage-slack')).toHaveAttribute('href', '/settings/connections/team%2Ftwo')
      await page.getByTestId('menu-slack').click()
      await page.getByTestId('disconnect-slack').click()
      await expect(page.getByTestId('settings-receipt')).toHaveText('disconnect:team/two')
      await openStory(page, `integrations-settings--detail-${theme}`, theme, viewport, baseURL)
      await expect(page.getByRole('button', { name: 'Test connection' })).toHaveCount(0)
      await page.getByRole('combobox', { name: 'Account for Slack' }).selectOption('team/two')
      await page.getByRole('combobox', { name: 'Decision for messages.send' }).selectOption('deny')
      await expect(page.getByTestId('settings-receipt')).toHaveText('decision:team/two:messages.send:deny')
      await page.getByRole('button', { name: 'Test connection' }).click()
      await expect(page.getByTestId('settings-receipt')).toHaveText('test:team/two')
      const disconnectContrast = await page.getByRole('button', { name: 'Disconnect' }).evaluate((button) => {
        const style = getComputedStyle(button)
        const channels = (color) => color.match(/[\d.]+/g).slice(0, 3).map((value) => {
          const channel = Number(value) / 255
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        const luminance = (color) => channels(color).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
        const foreground = luminance(style.color)
        const background = luminance(style.backgroundColor)
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      })
      expect(disconnectContrast).toBeGreaterThanOrEqual(4.5)
      await testInfo.attach(`detail-${theme}-${viewport.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    })
    test(`settings dialog keyboard ${theme} ${viewport.width}`, async ({ page, baseURL }) => {
      await openStory(page, 'integrations-settings--dialogs', theme, viewport, baseURL)
      for (const [openerName, fieldName, submitName] of [
        ['Open API-key dialog', 'API key', 'Connect'],
        ['Open OAuth-parameter dialog', 'Workspace', 'Continue'],
      ]) {
        const opener = page.getByRole('button', { name: openerName })
        await opener.focus()
        await page.keyboard.press('Enter')
        const dialog = page.getByRole('dialog', { name: 'Connect Slack' })
        const field = dialog.getByLabel(fieldName, { exact: true })
        await expect(field).toBeFocused()
        const submit = dialog.getByRole('button', { name: submitName, exact: true })
        await expect(submit).toBeDisabled()
        await field.fill('fixture-only')
        await submit.click()
        await expect(dialog.getByRole('alert')).toContainText('Fixture rejection')
        for (let step = 0; step < 10; step++) {
          await page.keyboard.press('Tab')
          expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
        }
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(opener).toBeFocused()
      }
    })
  }
}
