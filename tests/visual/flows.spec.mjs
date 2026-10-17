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

// Real layout geometry: the mobile header spans the viewport and the desktop
// layout reserves no header row at all; collapsing the rail widens the content.
for (const theme of themes) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    test(`dashboard-header-bounds ${theme} ${viewportName}`, async ({ page, baseURL }) => {
      await openStory(page, 'dashboard-dashboardlayout--labeled-rail', theme, viewport, baseURL)
      await page.evaluate((mode) => document.documentElement.classList.toggle('dark', mode === 'dark'), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      // CSS, not role: the open drawer marks the page behind it aria-hidden.
      const header = page.locator('nav[aria-label="Mobile navigation"]')
      const main = page.locator('main')
      const measure = async () => {
        const bounds = await header.boundingBox()
        expect(bounds.x).toBe(0)
        expect(bounds.x + bounds.width).toBe(viewport.width)
      }
      await test.info().attach('header geometry', { body: await page.screenshot(), contentType: 'image/png' })
      if (viewportName === 'desktop') {
        await expect(header).toBeHidden()
        const before = await main.boundingBox()
        expect(before.y).toBe(0)
        expect(before.x + before.width).toBe(viewport.width)
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
        await expect.poll(async () => (await main.boundingBox()).x).toBeLessThan(before.x)
        const after = await main.boundingBox()
        expect(after.y).toBe(0)
        expect(after.x + after.width).toBe(viewport.width)
      } else {
        await measure()
        await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await expect(page.getByRole('link', { name: 'Workspaces', exact: true })).toBeVisible()
        await measure()
      }
    })
  }
}

const recordingTest = test.extend({ video: 'on' })

for (const [viewportName, viewport] of Object.entries(viewports)) {
  recordingTest.describe(`pill-tabs-overflow ${viewportName}`, () => {
    recordingTest.use({ hasTouch: viewportName === 'mobile', isMobile: viewportName === 'mobile' })
    for (const theme of themes) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        recordingTest(`${theme} ${reducedMotion}`, async ({ page, baseURL }) => {
          await openStory(page, 'workbench-pilltabs--switch-views', theme, viewport, baseURL)
          await page.emulateMedia({ colorScheme: theme, reducedMotion })
          expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
            .toBe(reducedMotion === 'reduce')
          const host = page.getByTestId('pill-tabs-fixture')
          // The existing story is embedded in the same kind of local scrollport as a phone review pane.
          await host.evaluate(element => { element.style.width = '132px'; element.style.overflowX = 'auto' })
          await host.scrollIntoViewIfNeeded()
          const tabs = host.getByRole('tablist', { name: 'Workbench view' })
          const scrollState = () => host.evaluate(element => {
            const ancestors = []
            for (let node = element.parentElement; node; node = node.parentElement) ancestors.push(node.scrollTop)
            return { windowX: scrollX, windowY: scrollY, ancestors }
          })
          const before = await scrollState()
          if (viewportName === 'mobile') {
            const box = await host.boundingBox()
            const tabBox = await tabs.boundingBox()
            const startX = box.x + box.width * .85, endX = box.x + box.width * .15, y = tabBox.y + tabBox.height / 2
            const cdp = await page.context().newCDPSession(page)
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] })
            for (let step = 1; step <= 12; step++) {
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * step / 12, y }] })
              await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
            await expect.poll(() => host.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
            await cdp.detach()
          }
          await tabs.getByRole('tab', { name: 'Code', exact: true }).focus()
          const observations = []
          for (const [key, name] of [['Home', 'Code'], ['ArrowLeft', 'Changes'], ['ArrowLeft', 'Preview'],
            ['ArrowLeft', 'Code'], ['End', 'Changes'], ['ArrowRight', 'Code'], ['ArrowRight', 'Preview'],
            ['ArrowRight', 'Changes'], ['Home', 'Code'], ['End', 'Changes']]) {
            await page.keyboard.press(key)
            const tab = tabs.getByRole('tab', { name, exact: true })
            await expect(tab).toBeFocused()
            await expect(tab).toHaveAttribute('aria-selected', 'true')
            await expect(tabs.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
            await expect(tabs.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1)
            await expect(tab).toHaveAttribute('tabindex', '0')
            await expect(tab).toBeInViewport({ ratio: 1 })
            const bounds = await tab.evaluate(element => {
              const tab = element.getBoundingClientRect()
              const host = element.closest('[data-testid="pill-tabs-fixture"]')
              const rect = host.getBoundingClientRect()
              return { left: tab.left, right: tab.right, top: tab.top, bottom: tab.bottom, hostLeft: rect.left + host.clientLeft,
                hostRight: rect.left + host.clientLeft + host.clientWidth, hostTop: rect.top + host.clientTop,
                hostBottom: rect.top + host.clientTop + host.clientHeight, viewport: innerWidth, viewportHeight: innerHeight }
            })
            expect(bounds.left).toBeGreaterThanOrEqual(Math.max(0, bounds.hostLeft) - 1)
            expect(bounds.right).toBeLessThanOrEqual(Math.min(bounds.viewport, bounds.hostRight) + 1)
            expect(bounds.top).toBeGreaterThanOrEqual(Math.max(0, bounds.hostTop) - 1)
            expect(bounds.bottom).toBeLessThanOrEqual(Math.min(bounds.viewportHeight, bounds.hostBottom) + 1)
            await expect.poll(() => tabs.evaluate(element => {
              const active = element.querySelector('[aria-selected="true"]').getBoundingClientRect()
              const indicator = element.querySelector(':scope > [aria-hidden="true"]').getBoundingClientRect()
              return Math.max(Math.abs(active.left - indicator.left), Math.abs(active.width - indicator.width))
            })).toBeLessThan(2)
            const panel = host.getByRole('tabpanel')
            await expect(panel).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'))
            await expect(tab).toHaveAttribute('aria-controls', await panel.getAttribute('id'))
            await expect(panel).toHaveText(`Showing ${name.toLowerCase()}`)
            expect(await scrollState(), 'Tab navigation must preserve ancestor reading positions').toEqual(before)
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
            observations.push({ key, name, bounds })
          }
          await recordingTest.info().attach('tab reachability', { body: Buffer.from(JSON.stringify({ theme, viewportName, reducedMotion, observations }, null, 2)), contentType: 'application/json' })
          await recordingTest.info().attach('final tab', { body: await page.screenshot(), contentType: 'image/png' })
        })
      }
    }
  })
}
