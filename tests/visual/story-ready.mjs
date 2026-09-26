import { expect } from 'playwright/test'

const guards = new WeakMap()

export async function assertStoryHealthy(page) {
  const state = guards.get(page)
  // The catalog inventory test does not open a rendered story.
  if (!state) return
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'Horizontal scrolling belongs inside the component').toBeLessThanOrEqual(1)
  expect(state.externalRequests, 'Story fixtures must be self-contained').toEqual([])
  expect(state.errors, 'Story runtime errors invalidate snapshots').toEqual([])
}

export async function openStory(page, id, theme, viewport, baseURL) {
  if (!guards.has(page)) {
    const origin = new URL(baseURL).origin
    const state = { errors: [], externalRequests: [] }
    guards.set(page, state)
    page.on('pageerror', (error) => state.errors.push(error.message))
    // The fixed clock logs timer exceptions instead of emitting pageerror.
    page.on('console', (message) => {
      if (message.type() === 'error') state.errors.push(message.text())
    })
    const context = page.context()
    // Request events include redirects and service workers that bypass routing.
    context.on('request', (request) => {
      const url = new URL(request.url())
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) state.externalRequests.push(url.href)
    })
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
        return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    await context.routeWebSocket('**/*', (socket) => {
      const url = new URL(socket.url())
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
      if (url.origin !== origin) {
        state.externalRequests.push(socket.url())
        return socket.close()
      }
      socket.connectToServer()
    })
  }
  // Keep Date stable while Storybook timers run; frozen timers can leave stories blank.
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'))
  await page.setViewportSize(viewport)
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })

  const params = new URLSearchParams({
    id,
    viewMode: 'story',
    globals: `sandboxTheme:${theme}`,
  })
  await page.goto(`/iframe.html?${params}`, { waitUntil: 'load' })

  // Some full-screen stories paint visible descendants inside a zero-size root child.
  // Dialog stories render in a portal and leave the Storybook root empty.
  await expect(page.locator('#storybook-root :visible, [role="dialog"]:visible').first()).toBeVisible()
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-sandbox-ui', 'true')
  await page.waitForFunction(() => {
    const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
    return stylesheets.length > 0 && stylesheets.every((link) => Boolean(link.sheet)) &&
      Boolean(getComputedStyle(document.documentElement).getPropertyValue('--duration-fast').trim())
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => Array.from(document.querySelectorAll('body img')).every((img) => {
    const rect = img.getBoundingClientRect()
    const visible = rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0
    return !visible || (img.complete && img.naturalWidth > 0)
  }))
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  await assertStoryHealthy(page)
}

export async function waitForDiffRender(page, expectedText) {
  await page.waitForFunction(
    (text) => document.querySelector('[data-testid="diff-view"] diffs-container')?.shadowRoot?.textContent?.includes(text),
    expectedText,
  )
  // The diff custom element mounts after the initial story font wait.
  await page.evaluate(async () => {
    await document.fonts.load('400 13px "Geist Mono"')
    await document.fonts.ready
  })
}
