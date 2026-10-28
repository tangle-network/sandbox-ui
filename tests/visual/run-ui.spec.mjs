import { test, expect } from 'playwright/test'

for (const theme of ['dark', 'light']) {
  for (const width of [1280, 390]) {
    test(`run UI ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/iframe.html?id=workflows-agentgraph--live-run-cards&viewMode=story&globals=theme:${theme}`)
      await expect(page.locator('[data-layout="ready"]')).toBeVisible()
      const failed = page.locator('.ag-live-card[data-status="failed"]')
      await expect(failed).toContainText('regressed 38%')
      await expect(page.locator('.ag-live-slot[data-status="failed"]')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(`run-${theme}-${width}.png`), fullPage: true })
      const waiting = page.locator('[data-status="waiting"] .ag-live-pill').first()
      const running = page.locator('[data-status="running"] .ag-live-pill').first()
      expect(await waiting.evaluate(el => getComputedStyle(el).color)).not.toBe(await running.evaluate(el => getComputedStyle(el).color))
      expect(await waiting.evaluate(el => getComputedStyle(el).color)).toBe(await waiting.evaluate(el => getComputedStyle(document.documentElement).getPropertyValue('--surface-neutral-text').trim()))
      if (width === 390) {
        await expect(page.locator('[data-layout="list"]')).toBeVisible()
        await expect(page.locator('.react-flow__controls')).toHaveCount(0)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const loops = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity).map(a => ({ duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes() })))
      expect(new Set(loops.map(a => a.duration)).size).toBeLessThanOrEqual(1)
      expect(loops.flatMap(a => a.frames).some(f => f.transform)).toBe(false)
      expect(loops.length).toBeGreaterThan(0)
    })
  }
}
