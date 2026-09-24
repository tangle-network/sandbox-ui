import { expect } from 'playwright/test'

export async function openStory(page, id, theme, viewport) {
  await page.clock.install({ time: new Date('2026-09-23T12:00:00Z') })
  await page.setViewportSize(viewport)
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })

  const params = new URLSearchParams({
    id,
    viewMode: 'story',
    globals: `sandboxTheme:${theme}`,
  })
  await page.goto(`/iframe.html?${params}`, { waitUntil: 'load' })

  // Dialog stories render in a portal and leave the Storybook root empty.
  await expect(page.locator('#storybook-root > :visible, [role="dialog"]:visible').first()).toBeVisible()
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
