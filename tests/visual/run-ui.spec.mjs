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
      if (width === 1280) {
        const background = page.locator('.react-flow__background')
        expect(await background.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await background.evaluate(el => { const probe = document.createElement('span'); probe.style.backgroundColor = 'var(--bg-root)'; el.parentElement.append(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color }))
      }
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

// test:visual schedules this benchmark after the other browser workers finish.
test('17 agents stream at 3 events per second for 60 seconds', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  // HR-Time coarsens non-isolated clocks to 100µs plus jitter, enough to report
  // a 60Hz empty page as 16.8ms. Isolate this timing harness for 5µs resolution;
  // application bytes and the 16.7ms/50ms budgets stay unchanged.
  // https://w3c.github.io/hr-time/#dfn-coarsen-time
  await page.route('**/iframe.html**', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } })
  })
  await page.goto('/iframe.html?id=workflows-agentgraph--burst&viewMode=story&globals=sandboxTheme:dark')
  await expect(page.locator('[data-layout="ready"]')).toBeVisible()
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
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
      else { observer.disconnect(); frames.sort((a, b) => a - b); resolve({ crossOriginIsolated, frameCount: frames.length, p95: Math.round(frames[Math.ceil(frames.length * .95) - 1] * 1000) / 1000, maxLongTask: Math.max(0, ...longTasks), longTaskCount: longTasks.length }) }
    }
    requestAnimationFrame(frame)
  }))
  console.log(JSON.stringify({ kind: 'run-frame-metrics', ...metrics }))
  await testInfo.attach('frame-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' })
  expect(metrics.p95).toBeLessThanOrEqual(16.7)
  expect(metrics.maxLongTask).toBeLessThanOrEqual(50)
})


test('long failed evidence and keyboard focus stay reachable', async ({ page }) => {
  await page.setViewportSize({ width:1280, height:900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--live-failed-long&viewMode=story&globals=sandboxTheme:light')
  await expect(page.locator('[data-layout="ready"]')).toBeVisible()
  const failed = page.locator('.ag-live-card[data-status="failed"]').first()
  await expect(failed).toHaveAttribute('title', /final tool events/)
  await expect(failed.locator('.ag-live-failure')).toContainText('final tool events')
  await failed.getByRole('button', { name: /Failed.*Inspect/ }).click()
  await expect(failed).toHaveAttribute('data-selected', 'true')
  const card = page.locator('.react-flow__node-liveAgent').first()
  await card.focus()
  await card.press('ArrowDown')
  const focused = page.locator('.react-flow__node-liveAgent:focus .ag-live-card')
  await expect(focused).toHaveCount(1)
  expect(await focused.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
  await page.keyboard.press('Escape')
  await expect(page.locator('.agent-graph')).toBeFocused()
})

test('phone overview preserves known cost and failure evidence', async ({ page }) => {
  await page.setViewportSize({ width:390, height:900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--seventeen-agents&viewMode=story&globals=sandboxTheme:light')
  await expect(page.locator('[data-layout="list"]')).toBeVisible()
  const failed = page.locator('[data-agent-id="agent_scheduler"]')
  expect(await failed.textContent()).toContain('exited 137 (OOM)')
  expect(await failed.textContent()).toContain('$0.62')
  const done = page.locator('[data-agent-id="agent_battery"]')
  expect(await done.textContent()).toContain('Wrote battery-drain report')
  expect(await done.textContent()).toContain('$0.41')
})

test('trace graph uses recorded activity and leaves missing activity unknown', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--recorded-activity&viewMode=story&globals=sandboxTheme:dark')
  if (await page.getByRole('radio', { name: 'Graph', exact: true }).getAttribute('aria-checked') !== 'true') await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
  await expect(page.locator('.agent-graph [data-activity="quiet"]')).toHaveCount(1)
  await expect(page.locator('.ag-live-card[data-activity="quiet"]')).toContainText('Quiet 29m')
  await expect(page.locator('.ag-live-card[data-activity="quiet"]')).toContainText('root')
})

test('live headers retain recorded metadata without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--live-run-cards&viewMode=story&globals=sandboxTheme:light')
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
  const clipped = await page.locator('.ag-live-meta, .ag-live-accounting').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent))
  expect(clipped).toEqual([])
})

test('compact terminal rows retain Done and Stopped words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/iframe.html?id=workflows-agentgraph--seventeen-agents&viewMode=story&globals=sandboxTheme:light')
  await expect(page.locator('.agent-graph[data-layout="list"]')).toBeVisible()
  await expect(page.locator('.ag-live-chip[data-status="succeeded"]').first().getByText('Done', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.locator('.ag-live-chip[data-status="stopped"]').first().getByText('Stopped', { exact: true }).filter({ visible: true })).toBeVisible()
})

test('bordered graph keeps its layout stable at the container breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--graph-view&viewMode=story&globals=sandboxTheme:light')
  if (await page.getByRole('radio', { name: 'Graph', exact: true }).getAttribute('aria-checked') !== 'true') await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  const graph = page.locator('.agent-graph')
  await expect(graph).toHaveAttribute('data-layout', 'ready')
  await graph.evaluate(el => { Object.assign(el.style, { width: '601px', border: '1px solid transparent', boxSizing: 'border-box' }) })
  await expect.poll(() => graph.evaluate(el => el.clientWidth)).toBe(599)
  await expect(graph).toHaveAttribute('data-layout', 'list')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(graph).toHaveAttribute('data-layout', 'list')
  await graph.evaluate(el => { el.style.width = '602px' })
  await expect.poll(() => graph.evaluate(el => el.clientWidth)).toBe(600)
  await expect(graph).toHaveAttribute('data-layout', 'ready')
})

for (const width of [1280, 390]) test(`latest activity holds reading position and preserves unknown time ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/iframe.html?id=run-latestevents--reading&viewMode=story&globals=sandboxTheme:light')
  const feed = page.getByRole('region', { name: 'Latest activity' })
  await expect(feed.getByText('Timestamp not reported')).toBeVisible()
  await expect(feed.getByRole('button', { name: /^untimed / }).locator('time')).toHaveText('—')
  await feed.hover()
  await expect(feed).toContainText('Paused while reading')
  // Trigger a producer update without moving the pointer or keyboard out of the feed.
  await page.getByRole('button', { name: 'Append event', exact: true }).evaluate(element => element.click())
  await page.waitForTimeout(1200)
  await expect(feed.getByText('Ran integration check')).toHaveCount(0)
  await feed.getByRole('button', { name: 'Show latest' }).click()
  await expect(feed.getByText('Ran integration check')).toBeVisible()
  await page.mouse.move(1, 1)
  await page.getByRole('button', { name: 'Fail worker', exact: true }).click()
  await page.getByRole('button', { name: 'Finish untimed', exact: true }).click()
  await expect(feed.getByText('Integration check exited 1')).toBeVisible()
  await expect(feed.getByText('Failed', { exact: true })).toBeVisible()
  await expect(feed.locator('time').first()).toContainText('Observed')
  await expect(feed.getByRole('status')).toHaveText('worker: Failed; untimed: Done')
  await feed.getByRole('button', { name: /worker.*Integration check exited 1/ }).click()
  await expect(page.getByLabel('Selected agent')).toHaveText('worker')
  await page.mouse.move(1, 1)
  await page.getByRole('button', { name: 'Append event', exact: true }).focus()
  await expect(feed.getByText('Integration check exited 1')).toHaveCount(0)
})

test('one run view control preserves selection and exposes both graph layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--timeline-and-graph&viewMode=story&globals=sandboxTheme:dark')
  await expect(page.getByRole('radio', { name: 'Agents', exact: true })).toHaveCount(1)
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Latest activity' })).toHaveCount(1)
  await page.locator('.ag-live-card[data-status="failed"], .ag-agent-card[data-status="failed"]').first().click()
  await expect(page.getByRole('complementary', { name: 'verifier conversation' })).toBeVisible()
  // After the drawer resize settles, clock ticks must not reinitialize node measurement.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.evaluate(() => {
    window.__runResizeErrors = []
    addEventListener('error', event => { if (event.message.includes('ResizeObserver loop')) window.__runResizeErrors.push(event.message) })
  })
  await page.waitForTimeout(2200)
  expect(await page.evaluate(() => window.__runResizeErrors)).toEqual([])
  await page.getByRole('radio', { name: 'Steps', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'verifier conversation' })).toBeVisible()
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await page.getByRole('combobox', { name: 'Graph layout' }).selectOption('hub')
  await expect(page.locator('.ag-root')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'verifier conversation' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Graph layout' }).selectOption('tree')
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Latest activity' })).toHaveCount(1)
})


test('activity feed supports keyboard reading without a selection action', async ({ page }) => {
  await page.goto('/iframe.html?id=run-latestevents--empty&viewMode=story&globals=sandboxTheme:dark')
  const feed = page.getByRole('region', { name: 'Latest activity' })
  await feed.focus()
  await expect(feed).toBeFocused()
  await expect(feed).toContainText('Paused while reading')
  await expect(feed).toContainText('No activity events were reported.')
})


test('scrubbing without an epoch keeps historical changes out of observed activity', async ({ page }) => {
  await page.goto('/iframe.html?id=run-traceworkspace--timeline-and-graph&viewMode=story&globals=sandboxTheme:light')
  const slider = page.getByRole('slider', { name: 'Playback position' })
  await slider.fill('600000')
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
  await page.getByRole('radio', { name: 'Agents', exact: true }).click()
  await slider.fill('1000000')
  const feed = page.getByRole('region', { name: 'Latest activity' })
  await expect(feed.locator('.ag-latest-state')).toHaveCount(0)
  await expect(feed.getByRole('status')).toBeEmpty()
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await expect(page.locator('.agent-graph [data-status="failed"]')).toHaveCount(1)
})


test('recorded activity never inherits a later failure', async ({ page }) => {
  await page.goto('/iframe.html?id=run-latestevents--reading&viewMode=story&globals=sandboxTheme:light')
  const feed = page.getByRole('region', { name: 'Latest activity' })
  const recorded = feed.getByRole('button', { name: /worker Read source/ })
  const dot = () => recorded.locator('.ag-latest-dot').evaluate(element => ({ fill: getComputedStyle(element).backgroundColor, border: getComputedStyle(element).borderColor }))
  const initial = await dot()
  await page.getByRole('button', { name: 'Fail worker', exact: true }).click()
  await feed.getByRole('button', { name: /worker.*Integration check exited 1/ }).click()
  await page.getByRole('button', { name: 'Fail worker', exact: true }).focus()
  await page.mouse.move(1, 1)
  await expect(feed.locator('.ag-latest-state')).toHaveCount(0)
  await page.waitForTimeout(1200)
  expect(await dot()).toEqual(initial)
})

test('historical Running observations never add a liveness loop', async ({ page }) => {
  await page.goto('/iframe.html?id=run-latestevents--reading&viewMode=story&globals=sandboxTheme:light')
  const feed = page.getByRole('region', { name: 'Latest activity' })
  await page.getByRole('button', { name: 'Fail worker', exact: true }).click()
  await expect(feed.getByText('Failed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume worker', exact: true }).click()
  await expect(feed.getByText('Running', { exact: true })).toBeVisible()
  expect(await feed.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).length)).toBe(0)
})

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) test(`selected recorded evidence remains fully readable ${theme} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`/iframe.html?id=run-traceworkspace--agent-drawer-open&viewMode=story&globals=sandboxTheme:${theme}`)
  const drawer = page.getByRole('complementary', { name: 'verifier conversation' })
  const details = drawer.getByRole('region', { name: 'Recorded agent details' })
  await expect(details.getByText('Failure', { exact: true })).toBeVisible()
  const reason = details.locator('dd').filter({ hasText: 'Final retained diagnostic.' })
  await expect(reason).toHaveText('Checkout tests failed. ' + 'The retained compiler diagnostic identifies the affected integration boundary and the original exit status. '.repeat(10) + 'Final retained diagnostic.')
  expect(await reason.evaluate(element => getComputedStyle(element).webkitLineClamp)).toBe('none')
  await details.focus()
  await page.keyboard.press('End')
  await expect.poll(() => details.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('selected recorded facts appear only when known at the cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--agent-drawer-open&viewMode=story&globals=sandboxTheme:light')
  const details = page.getByRole('region', { name: 'Recorded agent details' })
  await expect(details.getByText('Failure', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Agents', exact: true }).click()
  await page.getByRole('slider', { name: 'Playback position' }).fill('500000')
  await expect(details).toHaveCount(0)
  await page.getByRole('slider', { name: 'Playback position' }).fill('800000')
  await expect(details.getByText('Failure', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'verifier conversation' })).toHaveCount(0)
})
