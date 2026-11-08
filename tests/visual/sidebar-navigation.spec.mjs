import { test, expect } from 'playwright/test'
import { assertStoryHealthy, openStory } from './story-ready.mjs'

const motionRoles = ['--duration-instant', '--duration-fast', '--duration-base', '--duration-slow', '--duration-stream', '--duration-arrive', '--ease-standard', '--ease-entrance', '--ease-exit', '--ease-expo', '--motion-control', '--motion-surface', '--motion-dismiss', '--motion-stream', '--motion-arrive', '--stagger-step', '--stagger-index', '--arrive-distance', '--stream-blur']

async function assertBrandMotion(page, theme, reducedMotion, info, phase) {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reducedMotion === 'reduce')
  const values = await page.evaluate(({ roles, theme }) => {
    const scope = document.createElement('div')
    scope.className = theme
    scope.dataset.theme = theme
    document.body.appendChild(scope)
    const read = node => Object.fromEntries(roles.map(role => [role, getComputedStyle(node).getPropertyValue(role).trim()]))
    const result = { root: read(document.documentElement), theme: read(scope) }
    scope.remove()
    return result
  }, { roles: motionRoles, theme })
  const durationMs = {}
  for (const [scope, roles] of Object.entries(values)) {
    for (const value of Object.values(roles)) expect(value).not.toBe('')
    durationMs[scope] = Object.fromEntries(Object.entries(roles).filter(([key]) => key.startsWith('--duration-')).map(([key, value]) => {
      expect(value).toMatch(/^(?:\d+(?:\.\d+)?|\.\d+)m?s$/)
      return [key, Number.parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)]
    }))
    for (const value of Object.values(durationMs[scope])) reducedMotion === 'reduce' ? expect(value).toBe(0) : expect(value).toBeGreaterThan(0)
  }
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

for (const theme of ['light', 'dark']) {
  test(`footer rows share the nav columns and a menu silences its tooltip ${theme}`, async ({ page, baseURL }, info) => {
    await openStory(page, 'dashboard-sidebarlayout--desktop', theme, { width: 1440, height: 900 }, baseURL)
    const columns = () => page.evaluate(() => {
      const rail = document.querySelector('[data-sidebar=true]')
      const box = (node) => node.getBoundingClientRect()
      const center = (node) => box(node).left + box(node).width / 2
      const nav = rail.querySelector('nav a')
      const label = [...nav.querySelectorAll('span')].find((node) => !node.querySelector('svg') && node.textContent.trim())
      const profile = rail.querySelector('button[aria-label="User menu"]')
      return {
        navIcon: center(nav.querySelector('svg')),
        navLabel: label && box(label).left,
        avatar: center(profile.querySelector('span')),
        name: profile.querySelector('p') && box(profile.querySelector('p')).left,
        profileHeight: box(profile).height,
      }
    })
    const open = await columns()
    expect(Math.abs(open.avatar - open.navIcon), 'avatar centred on the icon column').toBeLessThanOrEqual(0.5)
    expect(Math.abs(open.name - open.navLabel), 'name on the label column').toBeLessThanOrEqual(0.5)
    expect(open.profileHeight).toBe(36)
    await page.screenshot({ path: info.outputPath(`footer-expanded-${theme}.png`), animations: 'disabled' })

    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    const shut = await columns()
    expect(Math.abs(shut.avatar - shut.navIcon), 'collapsed avatar centred on the icon column').toBeLessThanOrEqual(0.5)
    const picker = page.getByRole('button', { name: 'Northwind Research Collective', exact: true }).filter({ visible: true })
    const tooltip = page.locator('[role=tooltip]')
    await picker.hover()
    await expect(tooltip).toContainText('$11.36')
    await picker.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(tooltip).toHaveCount(0)
    await page.mouse.move(700, 450)
    await picker.hover()
    await page.waitForTimeout(400)
    await expect(tooltip, 'the open menu already answers the tooltip').toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`footer-collapsed-menu-${theme}.png`), animations: 'disabled' })
  })

  test(`a router link in a drawer menu closes the drawer ${theme}`, async ({ page, baseURL }) => {
    await openStory(page, 'dashboard-sidebarlayout--desktop', theme, { width: 390, height: 844 }, baseURL)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
    expect((await drawer.getByRole('button', { name: 'User menu', exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44)
    await drawer.getByRole('button', { name: 'Northwind Research Collective', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Billing', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  })

  for (const [header, args] of [
    ['brand', ''],
    ['content', 'logo:!null;railHeaderContent:Workspace'],
    ['empty', 'logo:!null;railHeaderContent:!null'],
  ]) {
    for (const collapsed of [false, true]) {
      test(`rail toggle retains keyboard focus ${header} ${theme} initially ${collapsed ? 'collapsed' : 'expanded'}`, async ({ page, baseURL }, info) => {
        await openStory(page, 'dashboard-sidebarlayout--desktop', theme, { width: 1440, height: 900 }, baseURL)
        const url = new URL(page.url())
        url.searchParams.set('args', [args, `defaultRailCollapsed:${collapsed}`].filter(Boolean).join(';'))
        await page.goto(url.href)
        const before = page.getByRole('button', { name: collapsed ? 'Expand sidebar' : 'Collapse sidebar', exact: true })
        const after = page.getByRole('button', { name: collapsed ? 'Collapse sidebar' : 'Expand sidebar', exact: true })
        await before.focus()
        await page.keyboard.press('Enter')
        await expect(after).toBeFocused()
        await expect(after).toHaveAttribute('aria-pressed', String(!collapsed))
        await page.screenshot({ path: info.outputPath(`toggle-${header}-${theme}-${!collapsed}.png`), animations: 'disabled' })
        await page.keyboard.press('Space')
        await expect(before).toBeFocused()
        await expect(before).toHaveAttribute('aria-pressed', String(collapsed))
        await page.screenshot({ path: info.outputPath(`toggle-${header}-${theme}-${collapsed}.png`), animations: 'disabled' })
        await page.keyboard.press('Tab')
        await expect(before).not.toBeFocused()
      })
    }
  }
}

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
      await openStory(page, 'dashboard-sidebarlayout--controlled-header-menu-story', theme, viewport, baseURL,
        device === 'phone' ? { reducedMotion: 'no-preference' } : undefined)
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
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      // Observe the actual closed commit while Sheet still mounts its retiring
      // drawer. The product-owned header must stay there until retirement ends.
      await drawer.evaluate(node => {
        window.__headerExitSample = null
        const headers = scope => [...scope.querySelectorAll('button')]
          .filter(button => button.textContent.trim() === 'ReCenter').length
        const observer = new MutationObserver(() => {
          if (node.dataset.state !== 'closed') return
          window.__headerExitSample = {
            state: node.dataset.state,
            mounted: node.isConnected,
            drawerHeaders: headers(node),
            globalHeaders: headers(document),
            runningAnimations: node.getAnimations({ subtree: true })
              .filter(animation => animation.playState === 'running').length,
          }
          observer.disconnect()
        })
        observer.observe(document.body, { attributes: true, childList: true, subtree: true })
      })
      await drawer.getByRole('button', { name: 'Close navigation', exact: true }).click()
      await expect.poll(() => page.evaluate(() => window.__headerExitSample)).not.toBeNull()
      const exitSample = await page.evaluate(() => window.__headerExitSample)
      await info.attach('controlled-header-retiring-drawer', {
        body: JSON.stringify({ theme, reducedMotion: 'no-preference', ...exitSample }),
        contentType: 'application/json',
      })
      expect(exitSample).toMatchObject({ state: 'closed', mounted: true, globalHeaders: 1 })
      expect(exitSample.runningAnimations).toBeGreaterThan(0)
      expect(exitSample.drawerHeaders).toBe(1)
      await expect(drawer).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'ReCenter', exact: true })).toHaveCount(1)
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
        await expect.poll(() => status.evaluate(node => node.getAnimations().filter(a => a.playState === 'running').length)).toBe(0)
      }
      await page.screenshot({ path: info.outputPath(`quiet-desktop-${theme}-${reducedMotion}.png`) })
    })
  }
}
