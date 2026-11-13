import { test, expect } from 'playwright/test'

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

test('one run view control preserves selection and exposes both graph layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--timeline-and-graph&viewMode=story&globals=sandboxTheme:dark')
  await expect(page.getByRole('radio', { name: 'Agents', exact: true })).toHaveCount(1)
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  // The waterfall's bars already say what ran; the workspace draws no second activity feed under them.
  await expect(page.getByRole('region', { name: 'Latest activity' })).toHaveCount(0)
  await page.locator('.ag-live-card[data-status="failed"], .ag-agent-card[data-status="failed"]').first().click()
  await expect(page.getByLabel('verifier conversation', { exact: true })).toBeVisible()
  // After the drawer resize settles, clock ticks must not reinitialize node measurement.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.evaluate(() => {
    window.__runResizeErrors = []
    addEventListener('error', event => { if (event.message.includes('ResizeObserver loop')) window.__runResizeErrors.push(event.message) })
  })
  await page.waitForTimeout(2200)
  expect(await page.evaluate(() => window.__runResizeErrors)).toEqual([])
  await page.getByRole('radio', { name: 'Steps', exact: true }).click()
  await expect(page.getByLabel('verifier conversation', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Graph layout' }).getByRole('radio', { name: 'Hub' }).click()
  await expect(page.locator('.ag-root')).toBeVisible()
  await expect(page.getByLabel('verifier conversation', { exact: true })).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Graph layout' }).getByRole('radio', { name: 'Tree' }).click()
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
})


test('scrubbing without an epoch keeps the graph at the cursor', async ({ page }) => {
  await page.goto('/iframe.html?id=run-traceworkspace--timeline-and-graph&viewMode=story&globals=sandboxTheme:light')
  const slider = page.getByRole('slider', { name: 'Playback position' })
  await slider.fill('600000')
  await page.getByRole('radio', { name: 'Graph', exact: true }).click()
  await expect(page.locator('.agent-graph[data-layout="ready"]')).toBeVisible()
  await page.getByRole('radio', { name: 'Agents', exact: true }).click()
  await slider.fill('1000000')
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

for (const theme of ['dark', 'light']) for (const width of [1280, 390]) test(`selected agent inspector puts the failure and conversation first ${theme} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`/iframe.html?id=run-traceworkspace--agent-drawer-open&viewMode=story&globals=sandboxTheme:${theme}`)
  const inspector = page.getByLabel('verifier conversation', { exact: true })
  const failure = inspector.getByRole('region', { name: 'Failure' })
  await expect(failure).toContainText('Checkout tests failed.')
  if (width === 390) await expect(inspector).toBeFocused()
  await failure.getByRole('button', { name: 'Show all' }).click()
  const reason = failure.locator('p')
  await expect(reason).toHaveText('Checkout tests failed. ' + 'The retained compiler diagnostic identifies the affected integration boundary and the original exit status. '.repeat(10) + 'Final retained diagnostic.')
  expect(await reason.evaluate(element => getComputedStyle(element).webkitLineClamp)).toBe('none')
  // The conversation is the body; the recorded facts wait, closed, in Details, without the header's tokens.
  await expect(inspector.getByText('I could not finish the fix inside the budget.', { exact: false })).toBeVisible()
  // Back-to-back calls fold into one named row; no raw server-prefixed tool name or argument JSON reads inline.
  await expect(inspector.getByText(/^Ran 5 tools · /)).toBeVisible()
  await expect(inspector.getByText('Ran 2 tools · knowledge record, submit result')).toBeVisible()
  await expect(inspector.getByText(/mcp__|"result"/)).toHaveCount(0)
  const details = inspector.getByRole('region', { name: 'Recorded agent details' })
  await expect(details).toBeHidden()
  await inspector.getByText('Details', { exact: true }).click()
  await expect(details.getByText('Harness', { exact: true })).toBeVisible()
  await expect(details.getByText('Tokens', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  if (width === 390) {
    // A full-screen sheet: nothing of the waterfall painted over it, and Escape returns to the run.
    const box = await inspector.boundingBox()
    expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 900 })
    expect(await page.evaluate(() => document.elementFromPoint(195, 120)?.closest('[aria-label="verifier conversation"]') != null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(inspector).toHaveCount(0)
  }
})

test('docked inspector resizes by keyboard and pointer and remembers its width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--inspector-finished&viewMode=story&globals=sandboxTheme:dark')
  const inspector = page.getByLabel('sumcheck conversation', { exact: true })
  const separator = page.getByRole('separator', { name: 'Resize agent inspector' })
  const initial = (await inspector.boundingBox()).width
  await separator.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await inspector.boundingBox()).width).toBeGreaterThan(initial + 20)
  const box = await separator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, 400)
  await page.mouse.down()
  await page.mouse.move(900, 400, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await inspector.boundingBox()).width).toBeLessThan(560)
  expect((await inspector.boundingBox()).width).toBeGreaterThanOrEqual(360)
  const remembered = (await inspector.boundingBox()).width
  await page.reload()
  await expect.poll(async () => Math.abs((await page.getByLabel('sumcheck conversation', { exact: true }).boundingBox()).width - remembered)).toBeLessThan(3)
  expect(Number(await page.getByRole('separator', { name: 'Resize agent inspector' }).getAttribute('aria-valuenow'))).toBeGreaterThan(0)
})

test('an ended stream without rows says why instead of an empty pane', async ({ page }) => {
  await page.goto('/iframe.html?id=run-traceworkspace--inspector-no-transcript&viewMode=story&globals=sandboxTheme:light')
  const inspector = page.getByLabel('field-kernels conversation', { exact: true })
  const note = inspector.getByText('The codex harness did not capture a transcript for this agent.')
  await expect(note).toBeVisible()
  // The reason sits at the top under the failure and commission, and the facts are open, not a centred void.
  await expect(inspector.getByRole('region', { name: 'Failure' })).toContainText('budget-exhausted')
  expect((await note.boundingBox()).y).toBeLessThan(300)
  await expect(inspector.getByRole('region', { name: 'Recorded agent details' })).toBeVisible()
  await expect(inspector.getByText('The conversation ended.')).toHaveCount(0)
})

test('selected recorded facts appear only when known at the cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/iframe.html?id=run-traceworkspace--agent-drawer-open&viewMode=story&globals=sandboxTheme:light')
  const failure = page.getByRole('region', { name: 'Failure' })
  await expect(failure).toContainText('Checkout tests failed.')
  await expect(page.locator('.ov-hbars > li')).toHaveCount(5)
  await page.getByRole('slider', { name: 'Playback position' }).fill('500000')
  await expect(failure).toHaveCount(0)
  await expect(page.locator('.ov-hbars > li')).toHaveCount(0)
  await page.getByRole('slider', { name: 'Playback position' }).fill('800000')
  await expect(failure).toContainText('Checkout tests failed.')
  await expect(page.locator('.ov-hbars > li')).toHaveCount(5)
  await expect(page.locator('.ov-hbars-more')).toHaveAttribute('title', /recorded_tool_6: 1 · 1 failed · 2 ms \/ 3 ms \/ 4 ms p50\/p90\/p99/)
  await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
  await expect(page.getByLabel('verifier conversation', { exact: true })).toHaveCount(0)
})
