#!/usr/bin/env bash
# Before and after pictures of the two collapsed-rail defects, from the gate checkout.
# After: this commit's sidebar. Before: origin/main's sidebar, rebuilt in place.
# Each picture is printed as base64 between markers so it reaches the requester's log.
set -euo pipefail
cat > tests/visual/zz-rail-capture.spec.mjs <<'SPEC'
import { test, expect } from 'playwright/test'
import { openStory } from './story-ready.mjs'
const phase = process.env.RAIL_PHASE
test('rail pictures', async ({ page, baseURL }) => {
  await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 1440, height: 900 }, baseURL)
  const url = new URL(page.url())
  url.searchParams.set('args', 'logo:!null;railHeaderContent:Workspace;defaultRailCollapsed:true')
  await page.goto(url.href)
  const rail = page.locator('[data-sidebar=true]')
  await expect(rail.getByRole('link', { name: 'Vault', exact: true })).toBeVisible()
  await page.mouse.move(30, 28)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `rail-shots/${phase}-no-brand-hover.png`, clip: { x: 0, y: 0, width: 360, height: 300 }, animations: 'disabled' })
  await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 1440, height: 900 }, baseURL)
  await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await page.mouse.move(900, 450)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `rail-shots/${phase}-collapsed-group.png`, clip: { x: 0, y: 0, width: 240, height: 520 }, animations: 'disabled' })
})

// The flow as a person meets it, recorded: hover and click the top of a collapsed rail
// that has header content and no brand, then collapse the full story and pass over History.
test('rail recording', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ viewport: { width: 960, height: 600 }, recordVideo: { dir: 'rail-shots/video', size: { width: 960, height: 600 } } })
  const page = await context.newPage()
  await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 960, height: 600 }, baseURL)
  const url = new URL(page.url())
  url.searchParams.set('args', 'logo:!null;railHeaderContent:Workspace;defaultRailCollapsed:true')
  await page.goto(url.href)
  const rail = page.locator('[data-sidebar=true]')
  await expect(rail.getByRole('link', { name: 'Vault', exact: true })).toBeVisible()
  await page.mouse.move(400, 300)
  await page.waitForTimeout(1200)
  await page.mouse.move(30, 28, { steps: 12 })
  await page.waitForTimeout(1500)
  await page.mouse.click(30, 28)
  await page.waitForTimeout(2000)
  await openStory(page, 'dashboard-sidebarlayout--desktop', 'light', { width: 960, height: 600 }, baseURL)
  await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await page.mouse.move(400, 300)
  await page.waitForTimeout(1500)
  const history = await rail.getByRole('link', { name: 'History', exact: true }).boundingBox()
  await page.mouse.move(history.x + history.width / 2, history.y + history.height / 2, { steps: 12 })
  await page.waitForTimeout(1500)
  await page.mouse.move(400, 300, { steps: 12 })
  await page.waitForTimeout(1500)
  const video = page.video()
  await context.close()
  await video.saveAs(`rail-shots/${phase}-flow.webm`)
})
SPEC
mkdir -p rail-shots
shoot() {
  pnpm build-storybook --quiet > /dev/null 2>&1
  RAIL_PHASE=$1 pnpm exec playwright test tests/visual/zz-rail-capture.spec.mjs --retries=0 --reporter=line
}
shoot after
git show origin/main:src/dashboard/app-sidebar.tsx > src/dashboard/app-sidebar.tsx
shoot before
git checkout -- src/dashboard/app-sidebar.tsx
rm -f tests/visual/zz-rail-capture.spec.mjs
for f in rail-shots/*.png rail-shots/*.webm; do echo "==BEGIN $(basename "$f")"; base64 -w0 "$f"; echo; echo "==END"; done
