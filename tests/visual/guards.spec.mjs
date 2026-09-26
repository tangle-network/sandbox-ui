import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

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
