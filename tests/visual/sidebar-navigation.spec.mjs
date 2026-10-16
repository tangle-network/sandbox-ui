import { readFileSync } from 'node:fs'
import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

const brandTokenCss = readFileSync(new URL(import.meta.resolve('@tangle-network/brand/styles/tokens.css')), 'utf8')
const motionRoles = ['--duration-instant', '--duration-fast', '--duration-base', '--duration-slow', '--duration-stream', '--duration-arrive', '--ease-standard', '--ease-entrance', '--ease-exit', '--ease-expo', '--motion-control', '--motion-surface', '--motion-dismiss', '--motion-stream', '--motion-arrive', '--stagger-step', '--stagger-index', '--arrive-distance', '--stream-blur']

async function assertBrandMotion(page, theme, reducedMotion, info, phase) {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reducedMotion === 'reduce')
  const values = await page.evaluate(({ css, roles, theme }) => {
    // Compare the real cascade to installed Brand-only CSS; do not copy timings.
    const frame = document.createElement('iframe')
    frame.hidden = true
    document.body.appendChild(frame)
    const doc = frame.contentDocument
    doc.open()
    doc.write(`<html class="${theme}" data-theme="${theme}"><head><style>${css}</style></head><body><div class="${theme}" data-theme="${theme}"></div></body></html>`)
    doc.close()
    const scope = document.createElement('div')
    scope.className = theme
    scope.dataset.theme = theme
    document.body.appendChild(scope)
    const read = node => Object.fromEntries(roles.map(role => [role, node.ownerDocument.defaultView.getComputedStyle(node).getPropertyValue(role).trim()]))
    const result = { actualRoot: read(document.documentElement), actualTheme: read(scope), brandRoot: read(doc.documentElement), brandTheme: read(doc.body.firstElementChild) }
    scope.remove()
    frame.remove()
    return result
  }, { css: brandTokenCss, roles: motionRoles, theme })
  for (const value of Object.values(values.brandRoot)) expect(value).not.toBe('')
  expect(values.actualRoot).toEqual(values.brandRoot)
  expect(values.actualTheme).toEqual(values.brandTheme)
  const durationMs = Object.fromEntries(Object.entries(values.actualRoot).filter(([key]) => key.startsWith('--duration-')).map(([key, value]) => {
    expect(value).toMatch(/^\d+(?:\.\d+)?m?s$/)
    return [key, Number.parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)]
  }))
  for (const value of Object.values(durationMs)) reducedMotion === 'reduce' ? expect(value).toBe(0) : expect(value).toBeGreaterThan(0)
  await info.attach(`brand-motion-${phase}`, { body: JSON.stringify({ theme, reducedMotion, values, durationMs, measurement: 'computed CSS roles, not elapsed latency' }), contentType: 'application/json' })
}

// Keep interaction recordings uncut; static fixture baselines run separately.
test.use({ video: 'on' })

test.afterEach(async ({ page }) => { await assertStoryHealthy(page) })

for (const theme of ['light', 'dark']) {
  test(`mobile navigation layers and return focus ${theme}`, async ({ page, baseURL }, info) => {
    await openStory(page, 'dashboard-sidebarlayout--desktop', theme, { width: 390, height: 844 }, baseURL)
    const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
    await page.evaluate(() => { document.body.style.overflow = 'auto' })
    await opener.click()
    expect(await page.locator('body').evaluate(node => getComputedStyle(node).overflow)).toBe('hidden')
    const close = drawer.getByRole('button', { name: 'Close navigation', exact: true })
    const account = drawer.getByRole('button', { name: 'User menu', exact: true })
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(account).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await account.click()
    const appearance = page.getByRole('menuitem', { name: /Appearance/ })
    await appearance.focus()
    await appearance.press('ArrowRight')
    await expect(page.getByRole('menuitem', { name: 'Light', exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath(`navigation-appearance-${theme}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(drawer).toBeVisible()
    await expect(account).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(await page.locator('body').evaluate(node => getComputedStyle(node).overflow)).toBe('auto')
    await opener.click()
    await close.click()
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
    await opener.click()
    await page.mouse.click(380, 400)
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
    await opener.click()
    await page.screenshot({ path: info.outputPath(`navigation-open-${theme}.png`), animations: 'disabled' })
    // Serve an actual destination so the anchor exercises navigation without
    // asking Storybook's static server to invent a product route.
    await page.route('**/vault', route => route.fulfill({ contentType: 'text/html', body: '<h1>Vault destination</h1>' }))
    await drawer.getByRole('link', { name: 'Vault', exact: true }).click()
    await expect(page).toHaveURL(/\/vault$/)
    await expect(page.getByRole('heading', { name: 'Vault destination' })).toBeVisible()
  })
}

test('desktop keeps its rail and account menu', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 1440, height: 900 }, baseURL)
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Vault', exact: true })).toBeVisible()
  const account = page.getByRole('button', { name: 'User menu', exact: true }).filter({ visible: true })
  await account.click()
  const appearance = page.getByRole('menuitem', { name: /Appearance/ })
  await appearance.focus()
  await appearance.press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'Light', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(account).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toHaveCount(0)
})

for (const [breakpoint, width] of [['md', 768], ['lg', 1024]]) {
  test(`open navigation releases the page at ${breakpoint}`, async ({ page, baseURL }) => {
    await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 390, height: 844 }, baseURL)
    const url = new URL(page.url())
    url.searchParams.set('args', `hideBelow:${breakpoint}`)
    await page.goto(url.href)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible()
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveAttribute('data-scroll-locked')
    expect(await page.locator('body').evaluate(node => getComputedStyle(node).pointerEvents)).not.toBe('none')
    await page.route('**/vault', route => route.fulfill({ contentType: 'text/html', body: '<h1>Vault destination</h1>' }))
    await page.getByRole('link', { name: 'Vault', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vault destination' })).toBeVisible()
  })
}

// A product-owned `open` on the rail header (Hospitality's workspace switcher)
// once opened a second, offset menu from the copy mounted in the hidden phone bar.
for (const theme of ['light', 'dark']) {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    test(`controlled header menu opens exactly one menu on ${device} ${theme}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'dashboard-sidebarlayout--controlled-header-menu-story', theme, viewport, baseURL)
      await expect(page.getByRole('button', { name: 'ReCenter', exact: true })).toHaveCount(1)
      await page.getByRole('button', { name: 'ReCenter', exact: true }).click()
      await expect(page.getByRole('menu')).toHaveCount(1)
      await expect(page.getByRole('menuitem', { name: 'Create workspace', exact: true })).toHaveCount(1)
      await page.screenshot({ path: info.outputPath(`header-menu-${device}-${theme}.png`), animations: 'disabled' })
      if (device !== 'phone') return
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
      await drawer.getByRole('button', { name: 'ReCenter', exact: true }).click()
      await expect(page.getByRole('menu')).toHaveCount(1)
      await page.screenshot({ path: info.outputPath(`header-menu-drawer-${theme}.png`), animations: 'disabled' })
    })
  }
}


for (const theme of ['light', 'dark']) {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    test(`nav descriptions stay inside the viewport on ${device} ${theme}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'dashboard-sidebarlayout--desktop', theme, viewport, baseURL)
      if (device === 'phone') await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      const destination = page.getByRole('link', { name: 'Vault', exact: true }).filter({ visible: true })
      await destination.focus()
      await expect(destination).toHaveAttribute('aria-description', /Files, evidence and deliverables/)
      const tooltip = page.getByRole('tooltip', { includeHidden: true })
      await expect(tooltip).toBeVisible()
      await expect(tooltip).toContainText('Open a document to review what was produced.')
      await tooltip.evaluate(async node => {
        await Promise.all(node.getAnimations().map(animation => animation.finished))
      })
      const bounds = await tooltip.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
      await page.screenshot({ path: info.outputPath(`nav-description-${device}-${theme}.png`), animations: 'disabled' })
      await destination.blur()
      await expect(tooltip).toHaveCount(0)
    })
  }
}


for (const theme of ['light', 'dark']) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`phone dismissal reversal and preference changes ${theme} ${reducedMotion}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'dashboard-sidebarlayout--desktop', theme, { width: 390, height: 844 }, baseURL, { reducedMotion })
      await assertBrandMotion(page, theme, reducedMotion, info, 'initial')
      const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
      const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
      await opener.click()
      for (let reversal = 0; reversal < 3; reversal++) {
        await page.keyboard.press('Escape')
        // Keyboard reactivation while the old presence may still be retiring.
        await opener.press('Enter')
        await expect(drawer).toBeVisible()
        await expect.poll(() => drawer.evaluate(node => node.contains(document.activeElement))).toBe(true)
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await assertBrandMotion(page, theme, 'reduce', info, 'toggled-reduce')
      await expect.poll(() => drawer.evaluate(node => node.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity).length)).toBe(0)
      await page.screenshot({ path: info.outputPath(`reopened-${theme}-${reducedMotion}.png`) })
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(opener).toBeFocused()
      await expect(page.locator('body')).not.toHaveAttribute('data-scroll-locked')
      expect(await page.locator('body').evaluate(node => getComputedStyle(node).pointerEvents)).not.toBe('none')
      await opener.click()
      await drawer.getByRole('button', { name: 'Close navigation', exact: true }).click()
      await expect(drawer).toHaveCount(0)
      await expect(opener).toBeFocused()
      const roles = await page.evaluate(() => Object.fromEntries(['--motion-control', '--motion-surface', '--motion-dismiss', '--interaction-feedback-budget', '--interaction-pending-delay'].map(k => [k, getComputedStyle(document.documentElement).getPropertyValue(k).trim()])))
      for (const value of Object.values(roles)) expect(value).not.toBe('')
      await info.attach('brand-roles', { body: JSON.stringify({ theme, reducedMotion, roles }), contentType: 'application/json' })
    })

    test(`desktop layout stays quiet and disclosure stays inert ${theme} ${reducedMotion}`, async ({ page, baseURL }, info) => {
      await openStory(page, 'dashboard-sidebarlayout--expandable-groups', theme, { width: 1440, height: 900 }, baseURL, { reducedMotion })
      await assertBrandMotion(page, theme, reducedMotion, info, 'initial')
      const rail = page.locator('[data-sidebar="true"]')
      const main = page.getByRole('main')
      const closeGroup = page.getByRole('button', { name: 'Collapse Apps', exact: true })
      const region = page.locator(`[id="${await closeGroup.getAttribute('aria-controls')}"]`)
      await closeGroup.click()
      await expect.poll(() => region.evaluate(node => node.inert)).toBe(true)
      await expect.poll(async () => (await region.boundingBox()).height).toBe(0)
      await expect(region).toHaveCSS('transition-property', 'none')
      await page.getByRole('button', { name: 'Expand Apps', exact: true }).click()
      await expect.poll(() => region.evaluate(node => node.inert)).toBe(false)
      await expect(page.getByRole('link', { name: 'Sample app', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
      await expect(rail).toHaveCSS('transition-property', 'none')
      await expect(main).toHaveCSS('transition-property', 'none')
      expect(await rail.evaluate(node => node.getAnimations().length)).toBe(0)
      await page.getByRole('button', { name: 'Expand sidebar', exact: true }).first().click()
      if (reducedMotion === 'reduce') {
        await expect(page.getByText('Responding', { exact: true })).toBeVisible()
        const status = page.getByRole('status', { name: 'Agent responding' })
        expect(await status.evaluate(node => node.getAnimations().filter(a => a.playState === 'running').length)).toBe(0)
      }
      await page.screenshot({ path: info.outputPath(`quiet-desktop-${theme}-${reducedMotion}.png`) })
    })
  }
}
