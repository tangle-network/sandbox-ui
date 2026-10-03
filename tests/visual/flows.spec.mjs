import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory, waitForDiffRender } from './story-ready.mjs'

test.afterEach(async ({ page }) => {
  await assertStoryHealthy(page)
})

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
      test(`${flow.name} ${theme} ${viewportName}`, async ({ page, baseURL }) => {
        await openStory(page, flow.story, theme, viewport, baseURL)
        await flow.act(page)
        await expect(page).toHaveScreenshot(`${flow.name}-${theme}-${viewportName}.png`, {
          fullPage: false,
        })
      })
    }
  }
}

// Real layout geometry: a hidden mobile rail must not reserve header space.
for (const theme of themes) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    test(`dashboard-header-bounds ${theme} ${viewportName}`, async ({ page, baseURL }) => {
      await openStory(page, 'dashboard-dashboardlayout--labeled-rail', theme, viewport, baseURL)
      await page.evaluate((mode) => document.documentElement.classList.toggle('dark', mode === 'dark'), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const header = page.locator('nav').first()
      const measure = async () => {
        const bounds = await header.boundingBox()
        const content = await page.locator('main').boundingBox()
        expect(bounds.x).toBe(viewportName === 'mobile' ? 0 : content.x)
        expect(bounds.x + bounds.width).toBe(viewport.width)
      }
      await measure()
      await test.info().attach('header geometry', { body: await page.screenshot(), contentType: 'image/png' })
      if (viewportName === 'desktop') {
        const before = await header.boundingBox()
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
        await measure()
        expect((await header.boundingBox()).x).toBeLessThan(before.x)
      } else {
        await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await expect(page.getByRole('link', { name: 'Workspaces', exact: true })).toBeVisible()
        await measure()
      }
    })
  }
}
