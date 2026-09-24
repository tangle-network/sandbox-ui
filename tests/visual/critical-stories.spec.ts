import { readFileSync } from "node:fs"
import { test, expect } from "playwright/test"

interface StoryEntry { id: string; title: string; name: string; type: string; importPath: string }
const index = JSON.parse(readFileSync("storybook-static/index.json", "utf8")) as {
  entries: Record<string, StoryEntry>
}
const criticalModules = [
  "src/stories/dashboard/SandboxTable.stories.tsx",
  "src/stories/workbench/changes-pane.stories.tsx",
  "src/stories/workbench/DiffView.stories.tsx",
  "src/stories/workbench/PreviewView.stories.tsx",
  "src/stories/terminal/TerminalView.stories.tsx",
]
const entries = Object.values(index.entries ?? {}).filter((entry) => entry.type === "story")
for (const module of criticalModules) {
  if (!entries.some((entry) => entry.importPath.replace(/^\.\//, "") === module)) {
    throw new Error(`Critical Storybook module has no built states: ${module}`)
  }
}
const selected = entries.filter((entry) => criticalModules.includes(entry.importPath.replace(/^\.\//, "")))
if (!selected.length) throw new Error("No critical stories selected; a zero-test visual gate cannot pass")

for (const entry of selected) {
  if (!/^[a-z0-9_-]+$/i.test(entry.id)) throw new Error(`Unsafe Storybook ID: ${entry.id}`)
  test(`${entry.title}: ${entry.name}`, async ({ page, baseURL }, testInfo) => {
    const errors: string[] = []
    const externalRequests: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (url.origin === new URL(baseURL!).origin) return route.continue()
      externalRequests.push(`${url.origin}${url.pathname}`)
      return route.abort("blockedbyclient")
    })
    await page.clock.setFixedTime(new Date("2026-09-23T12:00:00Z"))
    const params = new URLSearchParams({
      id: entry.id,
      viewMode: "story",
      globals: `sandboxTheme:${testInfo.project.metadata.sandboxTheme}`,
    })
    await page.goto(`/iframe.html?${params}`, { waitUntil: "domcontentloaded" })
    const root = page.locator("#storybook-root")
    await expect(root).toBeVisible()
    await expect.poll(() => root.evaluate((element) => element.childElementCount)).toBeGreaterThan(0)
    await expect(page.locator(".sb-errordisplay")).not.toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    expect(errors, "A runtime exception is not a valid visual baseline").toEqual([])
    expect(externalRequests, "Fixtures must not require remote services or fonts").toEqual([])
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(pageOverflow, "Horizontal scroll belongs inside the pane, not on the page").toBeLessThanOrEqual(1)
    await expect(page).toHaveScreenshot(`${entry.id}.png`, { fullPage: true })
  })
}
