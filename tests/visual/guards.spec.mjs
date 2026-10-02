import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'
import { AA_NORMAL, contrast } from '../../scripts/text-dim-surfaces.mjs'

const viewport = { width: 390, height: 844 }

test('keeps mobile context removal named and usable', async ({ page, baseURL }) => {
  await openStory(page, 'workspace-statusbar--with-removable-badges', 'dark', viewport, baseURL)
  const remove = page.getByRole('button', { name: 'Remove sandbox-ui from context', exact: true })
  await page.keyboard.press('Tab')
  await expect(remove).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(remove).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remove README.md from context', exact: true })).toBeVisible()
  await expect(page.getByText('31,000')).toBeVisible()
  await assertStoryHealthy(page)
})

test('blocks an unexpected WebSocket after a flow opens', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  await page.evaluate(() => new Promise((resolve) => {
    const socket = new WebSocket('wss://visual-guard.invalid/capture')
    socket.addEventListener('close', resolve, { once: true })
  }))
  await page.screenshot()
  await expect(assertStoryHealthy(page)).rejects.toThrow('Story fixtures must be self-contained')
})

test('blocks an unexpected request after a flow opens', async ({ page, baseURL }) => {
  let externalCompleted = false
  await page.context().route('https://visual-guard.invalid/**', async (route) => {
    externalCompleted = true
    await route.fulfill({ body: 'unexpected service' })
  })
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  await page.evaluate(() => fetch('https://visual-guard.invalid/capture').catch(() => undefined))
  await page.screenshot()
  expect(externalCompleted).toBe(false)
  await expect(assertStoryHealthy(page)).rejects.toThrow('Story fixtures must be self-contained')
})

test('rejects document overflow introduced after a flow opens', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  await page.evaluate(() => {
    const element = document.createElement('div')
    element.style.cssText = 'position:absolute;left:0;top:0;width:900px;height:1px'
    document.body.append(element)
  })
  await page.screenshot()
  await expect(assertStoryHealthy(page)).rejects.toThrow('Horizontal scrolling belongs inside the component')
})

test('keeps desktop sandbox scope and actions within their cells', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxtable--long-names-with-scope', 'light', { width: 1440, height: 900 }, baseURL)
  const row = page.getByRole('region', { name: 'Sandbox list' }).locator('tbody tr').first()
  const scopeCell = row.locator('td').nth(2)
  const scopeBadge = scopeCell.locator('div[title]').first()
  const environmentText = row.locator('td').nth(3).locator('span[title]').first()
  await expect(scopeBadge).toBeVisible()
  await expect(environmentText).toBeVisible()
  const scopeBounds = await scopeCell.boundingBox()
  const badgeBounds = await scopeBadge.boundingBox()
  const environmentBounds = await environmentText.boundingBox()
  expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(scopeBounds.x + scopeBounds.width)
  expect(badgeBounds.x + badgeBounds.width + 8).toBeLessThanOrEqual(environmentBounds.x)

  const actionTops = await row.locator('td').last().getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().top),
  )
  expect(actionTops).toHaveLength(5)
  expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThan(2)
  await assertStoryHealthy(page)
})

test('keeps the desktop provisioning status clear of the sandbox name', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxtable--long-names-with-scope', 'light', { width: 1440, height: 900 }, baseURL)
  const row = page.getByRole('region', { name: 'Sandbox list' }).locator('tbody tr').nth(2)
  const statusCell = row.locator('td').first()
  const statusLabel = statusCell.locator('span').last()
  const sandboxName = row.locator('td').nth(1).locator('span[title]').first()
  await expect(statusLabel).toHaveText('Provisioning')
  await expect(sandboxName).toBeVisible()

  const cellBounds = await statusCell.boundingBox()
  const labelBounds = await statusLabel.boundingBox()
  const nameBounds = await sandboxName.boundingBox()
  expect(labelBounds.x + labelBounds.width).toBeLessThanOrEqual(cellBounds.x + cellBounds.width)
  expect(labelBounds.x + labelBounds.width + 12).toBeLessThanOrEqual(nameBounds.x)
  await assertStoryHealthy(page)
})

for (const theme of ['light', 'dark']) {
  test(`keeps sandbox table accent text readable in ${theme} mode`, async ({ page, baseURL }) => {
    await openStory(page, 'dashboard-sandboxtable--long-names-with-scope', theme, { width: 1440, height: 900 }, baseURL)
    const rows = page.getByRole('region', { name: 'Sandbox list' }).locator('tbody tr')
    const text = {
      provisioning: rows.nth(2).locator('td').first().locator('span').last(),
      percentage: rows.first().getByText('34%', { exact: true }).first(),
      allocation: rows.nth(2).locator('td').nth(4).locator('span[title]').first(),
      resume: rows.nth(1).getByRole('button', { name: 'Resume' }),
    }

    const rgb = (value) => {
      const match = value.match(/^rgb\((\d+), (\d+), (\d+)\)$/)
      expect(match, `Expected an opaque browser color, received ${value}`).not.toBeNull()
      return match.slice(1).map(Number)
    }
    const readable = async (label, locator) => {
      const colors = await locator.evaluate((element) => {
        let plane = element
        while (plane && !getComputedStyle(plane).backgroundColor.startsWith('rgb(')) plane = plane.parentElement
        return { foreground: getComputedStyle(element).color, background: plane && getComputedStyle(plane).backgroundColor }
      })
      expect(contrast(rgb(colors.foreground), rgb(colors.background)), `${theme} ${label} on its rendered surface`).toBeGreaterThanOrEqual(AA_NORMAL)
    }

    for (const [label, locator] of Object.entries(text)) await readable(label, locator)
    const name = rows.first().locator('td').nth(1).locator('span[title]').first()
    await name.hover()
    await page.waitForTimeout(200)
    await readable('hovered name', name)
    await assertStoryHealthy(page)
  })
}

test('rejects runtime errors recorded after a screenshot', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  await page.screenshot()
  await Promise.all([
    page.waitForEvent('console', (message) => message.type() === 'error' && message.text().includes('capture-time failure')),
    page.evaluate(() => setTimeout(() => { throw new Error('capture-time failure') }, 0)),
  ])
  await expect(assertStoryHealthy(page)).rejects.toThrow('Story runtime errors invalidate snapshots')
})

test('rejects external requests reached through a same-origin redirect', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  const target = new URL('/index.json', baseURL)
  target.hostname = 'localhost'
  await page.context().route('**/guard-redirect', (route) => route.fulfill({
    status: 302, headers: { Location: target.href },
  }))
  const requested = page.context().waitForEvent('request', (request) => request.url() === target.href)
  await page.evaluate(() => fetch('/guard-redirect').catch(() => undefined))
  await requested
  await page.screenshot()
  await expect(assertStoryHealthy(page)).rejects.toThrow('Story fixtures must be self-contained')
})

test('rejects external requests made by a service worker', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sandboxcard--running', 'dark', viewport, baseURL)
  const target = new URL('/index.json', baseURL)
  target.hostname = 'localhost'
  await page.context().route('**/guard-sw.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
      self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
      self.addEventListener('message', event => event.waitUntil(
        fetch(${JSON.stringify(target.href)}).catch(() => {}).then(() => event.source.postMessage('done'))
      ))
    `,
  }))
  const requested = page.context().waitForEvent('request', (request) => request.url() === target.href && Boolean(request.serviceWorker()))
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/guard-sw.js')
    await navigator.serviceWorker.ready
    await new Promise((resolve) => {
      if (navigator.serviceWorker.controller) resolve()
      else navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
    })
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('message', resolve, { once: true })
      navigator.serviceWorker.controller.postMessage('fetch')
    })
  })
  await requested
  await page.screenshot()
  await expect(assertStoryHealthy(page)).rejects.toThrow('Story fixtures must be self-contained')
})

test('keeps an embedded app interactive and its toolbar usable on mobile', async ({ page, baseURL }) => {
  await openStory(page, 'workbench-embeddedappview--ready', 'dark', viewport, baseURL)
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'Local preview fixture' })).toBeVisible()
  await frame.getByRole('button', { name: 'Test preview interaction' }).click()
  await expect(frame.locator('#result')).toHaveText('The preview button works.')
  const reload = page.getByRole('button', { name: 'Reload Reporting' })
  await reload.focus()
  await page.keyboard.press('Enter')
  await expect(frame.locator('#result')).toContainText('The frame loaded.')
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-forms')
  await expect(page.getByRole('link', { name: 'Open Reporting in new tab' })).toHaveAttribute('href', /preview-fixture/)
  await assertStoryHealthy(page)

  await openStory(page, 'workbench-embeddedappview--with-toolbar-actions', 'dark', viewport, baseURL)
  const toolbar = page.getByRole('heading', { name: 'Reporting' }).locator('..')
  const bounds = await toolbar.evaluate((element) => {
    const open = element.querySelector('[aria-label="Open Reporting in new tab"]')
    return {
      height: element.getBoundingClientRect().height,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      openRight: open?.getBoundingClientRect().right,
      toolbarRight: element.getBoundingClientRect().right,
    }
  })
  expect(bounds.height).toBe(56)
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth)
  expect(bounds.openRight).toBeLessThanOrEqual(bounds.toolbarRight)
  await assertStoryHealthy(page)
})
