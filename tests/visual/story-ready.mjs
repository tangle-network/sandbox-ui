import { expect } from 'playwright/test'

export async function openStory(page, id, theme, viewport) {
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
