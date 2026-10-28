import { test, expect } from 'playwright/test'

for (const theme of ['dark', 'light']) {
  for (const width of [1280, 390]) {
    test(`run UI ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/iframe.html?id=workflows-agentgraph--live-run-cards&viewMode=story&globals=sandboxTheme:${theme}`)
      await expect(page.locator('[data-layout="ready"], [data-layout="list"]')).toBeVisible()
      const failed = page.locator('.ag-live-card[data-status="failed"]')
      await expect(failed).toContainText('regressed 38%')
      await expect(page.locator('.ag-live-slot[data-status="failed"]')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(`run-${theme}-${width}.png`), fullPage: true })
      const waiting = page.locator('[data-status="waiting"] .ag-live-pill').first()
      const running = page.locator('[data-status="running"] .ag-live-pill').first()
      expect(await waiting.evaluate(el => getComputedStyle(el).color)).not.toBe(await running.evaluate(el => getComputedStyle(el).color))
      expect(await waiting.evaluate(el => getComputedStyle(el).color)).toBe(await waiting.evaluate(el => { const probe = document.createElement('span'); probe.style.color = 'var(--surface-neutral-text)'; el.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color }))
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

async function textContrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v / 255) }
    const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1)
    const luminance = c => c.slice(0, 3).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
    const failures = []
    const walk = document.createTreeWalker(document.querySelector('.agent-graph, .ag-root'), NodeFilter.SHOW_TEXT)
    while (walk.nextNode()) {
      const text = walk.currentNode
      if (!text.textContent.trim()) continue
      const element = text.parentElement
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || !element.getClientRects().length || element.closest('.sr-only, [aria-hidden="true"], style, script')) continue
      const box = element.getBoundingClientRect()
      if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue
      const ancestors = []; for (let p = element; p; p = p.parentElement) ancestors.unshift(p)
      let bg = [1, 1, 1, 1], opacity = 1
      for (const ancestor of ancestors) { const s = getComputedStyle(ancestor); bg = over(rgba(s.backgroundColor), bg); opacity *= Number(s.opacity) }
      const fg = rgba(style.color); fg[3] *= opacity
      const ink = luminance(over(fg, bg)), surface = luminance(bg)
      const contrast = (Math.max(ink, surface) + .05) / (Math.min(ink, surface) + .05)
      const minimum = parseFloat(style.fontSize) >= 18 ? 3 : 4.5
      if (contrast + .01 < minimum) failures.push({ text: text.textContent.trim(), contrast, minimum, color: style.color })
    }
    return failures
  })
}

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) {
  test(`attention hierarchy ${theme} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/iframe.html?id=workflows-agentgraph--seventeen-live&viewMode=story&globals=sandboxTheme:${theme}`)
    await expect(page.locator('[data-layout="ready"], [data-layout="list"]')).toBeVisible()
    await expect(page.locator('.ag-live-card')).toHaveCount(17)
    await expect(page.locator('.ag-live-card[data-activity="quiet"]')).toContainText('Quiet 12m')
    await expect(page.locator('.ag-live-card[data-status="needs-you"] button')).toHaveText('Respond')
    await expect(page.locator('.ag-live-card[data-status="failed"] .ag-live-thinking').first()).toContainText('exited 137')
    expect(await page.locator('[data-activity="quiet"] .ag-running-dot').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
    await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.animationName === 'agent-arrive').map(a => a.finished.catch(() => {}))))
    expect(await textContrast(page)).toEqual([])
    if (width === 390) {
      await expect(page.locator('.ag-phone-list > li').first().locator('[data-status]')).toHaveAttribute('data-status', 'needs-you')
      await expect(page.locator('.react-flow')).toHaveCount(0)
      await page.getByRole('button', { name: 'Respond', exact: true }).click()
      await expect(page.locator('.ag-phone-select[aria-pressed="true"]')).toContainText('Needs you')
    }
    await expect.poll(() => page.locator('[data-attn]').count(), { timeout: 2100 }).toBe(0)
    await page.screenshot({ path: testInfo.outputPath(`seventeen-${theme}-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
  test(`hub phone and motion ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/iframe.html?id=workflows-agentgraph-hub--needs-you&viewMode=story&globals=sandboxTheme:${theme}`)
    await expect(page.locator('.ag-root')).toBeVisible()
    if (width === 390) {
      await expect(page.locator('.ag-mobile')).toBeVisible()
      await expect(page.locator('.ag-edges')).toHaveCount(0)
    }
    expect(await textContrast(page)).toEqual([])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).flatMap(a => a.effect.getKeyframes()).some(f => f.transform))).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}

test('17 agents stream at 3 events per second for 60 seconds', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--burst&viewMode=story&globals=sandboxTheme:dark')
  await expect(page.locator('[data-layout="ready"]')).toBeVisible()
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.animationName === 'agent-arrive').map(a => a.finished.catch(() => {}))))
  const metrics = await page.evaluate(() => new Promise(resolve => {
    const frames = [], longTasks = []
    const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e => e.duration)))
    observer.observe({ type: 'longtask' })
    let previous, start
    function frame(now) {
      start ??= now
      if (previous !== undefined) frames.push(now - previous)
      previous = now
      if (now - start < 60_000) requestAnimationFrame(frame)
      else { observer.disconnect(); frames.sort((a, b) => a - b); resolve({ frameCount: frames.length, p95: Math.round(frames[Math.ceil(frames.length * .95) - 1] * 1000) / 1000, maxLongTask: Math.max(0, ...longTasks), longTaskCount: longTasks.length }) }
    }
    requestAnimationFrame(frame)
  }))
  console.log(JSON.stringify({ kind: 'run-frame-metrics', ...metrics }))
  await testInfo.attach('frame-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' })
  expect(metrics.p95).toBeLessThanOrEqual(16.7)
  expect(metrics.maxLongTask).toBeLessThanOrEqual(50)
})
