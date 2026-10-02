import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

test.afterEach(async ({ page }) => {
  await assertStoryHealthy(page)
})

test('keyboard enrollment waits for host confirmation', async ({ page, baseURL }) => {
  await openStory(page, 'connections-agentmessagingconnection--ready-to-enroll', 'dark', { width: 390, height: 844 }, baseURL)
  await expect(page.getByText('Shared conversation for this member')).toHaveCount(0)

  await page.keyboard.press('Tab')
  const action = page.getByRole('button', { name: 'Connect agent' })
  await expect(action).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByText('Connecting your agent…')).toBeVisible()
  await expect(page.getByText('Shared conversation for this member')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open messages' })).toHaveCount(0)
})
