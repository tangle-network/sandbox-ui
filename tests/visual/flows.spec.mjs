import { test, expect } from 'playwright/test'
import { openStory, waitForDiffRender } from './story-ready.mjs'

const themes = ['dark', 'light']
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

const flows = [
  {
    name: 'dashboard-action-menu',
    story: 'dashboard-sandboxcard--running',
    act: async (page) => {
      await page.getByRole('button', { name: 'Sandbox options' }).click()
      await expect(page.getByRole('menuitem', { name: 'Stop Sandbox' })).toBeVisible()
    },
  },
  {
    name: 'session-selection',
    story: 'workspace-sessionsidebar--interactive',
    act: async (page) => {
      await page.getByRole('textbox', { name: 'Search sessions' }).fill('Auth token')
      const session = page.getByRole('button', { name: /Auth token refresh/ })
      await session.click()
      await expect(session).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('button', { name: /File ingestion pipeline/ })).toHaveCount(0)
    },
  },
  {
    name: 'artifact-diff',
    story: 'workbench-sandboxartifactpane--default',
    act: async (page) => {
      const diff = page.getByRole('tab', { name: 'Diff' })
      await diff.click()
      await expect(diff).toHaveAttribute('aria-selected', 'true')
      await waitForDiffRender(page, 'RetryOptions')
    },
  },
  {
    name: 'integration-disconnect',
    story: 'integrations-integrationspanel--default',
    act: async (page) => {
      await page.getByTestId('integration-search').fill('Slack')
      await page.getByTestId('integration-slack').click()
      await page.getByRole('button', { name: 'More actions for Slack' }).click()
      await page.getByTestId('disconnect-slack').click()
      await expect(page.getByRole('dialog', { name: 'Disconnect Slack?' })).toBeVisible()
    },
  },
  {
    name: 'provisioning-options',
    story: 'pages-provisioningwizard--one-page',
    act: async (page) => {
      await page.getByRole('button', { name: 'Show Advanced Options' }).click()
      await page.getByPlaceholder('my-cool-sandbox').fill('review-sandbox')
      await expect(page.getByPlaceholder('my-cool-sandbox')).toHaveValue('review-sandbox')
      const perSecond = page.getByRole('button', { name: 'Per Second' })
      await perSecond.click()
      await expect(perSecond).toHaveAttribute('aria-pressed', 'true')
    },
  },
]

for (const flow of flows) {
  for (const theme of themes) {
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      test(`${flow.name} ${theme} ${viewportName}`, async ({ page }) => {
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await openStory(page, flow.story, theme, viewport)
        await flow.act(page)
        try {
          await expect(page).toHaveScreenshot(`${flow.name}-${theme}-${viewportName}.png`, {
            fullPage: false,
          })
        } finally {
          expect(errors, 'Flow runtime errors invalidate snapshots').toEqual([])
        }
      })
    }
  }
}
