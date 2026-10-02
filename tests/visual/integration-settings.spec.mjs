import { test, expect } from 'playwright/test'
import { openStory, assertStoryHealthy } from './story-ready.mjs'

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })
for (const theme of ['light', 'dark']) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`Inkbox account keyboard and reopen ${theme} ${viewport.width}`, async ({ page, baseURL }, testInfo) => {
      await openStory(page, 'integrations-settings--inkbox-account-selection', theme, viewport, baseURL)
      // GTM applies Brand's light/dark class to the root, including portalled controls.
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle('light', theme === 'light')
        document.documentElement.classList.toggle('dark', theme === 'dark')
        document.documentElement.setAttribute('data-sandbox-theme', '')
        document.getElementById('sandbox-theme-bg').textContent = 'body { background: var(--bg-base) !important; }'
      }, theme)
      const trigger = page.getByRole('combobox', { name: 'Account for Inkbox' })
      await expect(trigger).toHaveText('@tangle-operator')
      await trigger.focus()
      await trigger.press('Space')
      await expect(page.getByRole('option', { name: '@tangle-operator', exact: true })).toBeFocused()
      await expect(page.getByRole('option')).toHaveCount(4)
      await testInfo.attach(`account-open-${theme}-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' })
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('option', { name: '@team · …e_123456', exact: true })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(trigger).toHaveText('@team · …e_123456')
      expect(await page.evaluate(() => localStorage.getItem('sandbox-ui-inkbox-account-picker-story'))).toBe('hubconn_inkbox_team_one_123456')
      await page.reload()
      await expect(trigger).toHaveText('@team · …e_123456')
    })
    test(`permission controls stay compact ${theme} ${viewport.width}`, async ({ page, baseURL }, testInfo) => {
      await openStory(page, 'integrations-settings--inkbox-permission-controls', theme, viewport, baseURL)
      const trigger = page.getByRole('combobox', { name: 'Decision for messages.send' })
      const controls = trigger.locator('..')
      const source = controls.getByText('Stored override')
      const reset = controls.getByRole('button', { name: 'Reset messages.send' })
      const boxes = await Promise.all([source, trigger, reset].map((item) => item.boundingBox()))
      if (viewport.width >= 640) {
        const centers = boxes.map((box) => box.y + box.height / 2)
        expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      await expect(page.getByRole('combobox', { name: 'Decision for messages.list' })).toHaveText('Not available')
      await trigger.focus()
      await trigger.press('Space')
      await expect(page.getByRole('option', { name: 'Allow', exact: true })).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('option', { name: 'Deny', exact: true })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('settings-receipt')).toHaveText('decision:hubconn_inkbox_operator_abcdef:messages.send:deny')
      await reset.click()
      await expect(page.getByTestId('settings-receipt')).toHaveText('reset:hubconn_inkbox_operator_abcdef:messages.send')
      await testInfo.attach(`permission-${theme}-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' })
    })
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
      await expect(selector).toHaveText('Select an account')
      await expect(page.getByTestId('manage-slack')).toHaveCount(0)
      const category = page.getByRole('combobox', { name: 'Filter by category' })
      await category.click()
      await page.getByRole('option', { name: 'Productivity', exact: true }).click()
      await expect(selector).toHaveCount(0)
      await category.click()
      await page.getByRole('option', { name: 'All categories', exact: true }).click()
      await expect(selector).toHaveText('Select an account')
      await selector.click()
      await page.getByRole('option', { name: 'Team 2 · operations@example.test' }).click()
      await expect(page.getByTestId('manage-slack')).toHaveAttribute('href', '/settings/connections/team%2Ftwo')
      await page.getByTestId('menu-slack').click()
      await page.getByTestId('disconnect-slack').click()
      await expect(page.getByTestId('settings-receipt')).toHaveText('disconnect:team/two')
      await openStory(page, `integrations-settings--detail-${theme}`, theme, viewport, baseURL)
      await expect(page.getByRole('button', { name: 'Test connection' })).toHaveCount(0)
      await page.getByRole('combobox', { name: 'Account for Slack' }).click()
      await page.getByRole('option', { name: 'Team 2 · operations@example.test' }).click()
      await page.getByRole('combobox', { name: 'Decision for messages.send' }).click()
      await page.getByRole('option', { name: 'Deny', exact: true }).click()
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
