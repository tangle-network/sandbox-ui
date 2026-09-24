import { readFileSync } from 'node:fs'
import { test, expect } from 'playwright/test'
import { openStory, waitForDiffRender } from './story-ready.mjs'

const index = JSON.parse(readFileSync(new URL('../../storybook-static/index.json', import.meta.url)))
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story')
const criticalModules = [
  'src/stories/dashboard/SandboxTable.stories.tsx',
  'src/stories/workbench/changes-pane.stories.tsx',
  'src/stories/workbench/DiffView.stories.tsx',
  'src/stories/workbench/PreviewView.stories.tsx',
  'src/stories/terminal/TerminalView.stories.tsx',
]
const themes = ['dark', 'light']
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}
const tablet = { width: 768, height: 1024 }

test('catalog contains stories and critical states', () => {
  expect(stories.length).toBeGreaterThan(0)
  for (const module of criticalModules) {
    expect(stories.some((story) => story.importPath.replace(/^\.\//, '') === module), module).toBe(true)
  }
})

for (const story of stories) {
  const critical = criticalModules.includes(story.importPath.replace(/^\.\//, ''))
  const storyViewports = critical ? { ...viewports, tablet } : viewports
  for (const theme of themes) {
    for (const [viewportName, viewport] of Object.entries(storyViewports)) {
      test(`${story.id} ${theme} ${viewportName}`, async ({ page, baseURL }) => {
        const errors = []
        const externalRequests = []
        page.on('pageerror', (error) => errors.push(error.message))
        if (critical) {
          await page.route('**/*', (route) => {
            const url = new URL(route.request().url())
            if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL).origin) {
              externalRequests.push(url.href)
              return route.abort('blockedbyclient')
            }
            return route.continue()
          })
        }
        await openStory(page, story.id, theme, viewport)
        if (/^workbench-changespane--(default|many-files|commit-failed|committing)$/.test(story.id) ||
          story.id === 'workbench-sandboxartifactpane--diff-active') {
          await waitForDiffRender(page, 'RetryOptions')
        }
        if (story.id === 'workbench-diffview--changed-line') {
          await waitForDiffRender(page, 'retryDelay')
        }
        if (story.id.startsWith('workflows-')) {
          await expect(page.locator('.react-flow__node').first()).toBeVisible()
          await expect(page.getByText('Loading graph...')).toHaveCount(0)
        }
        if (critical) {
          expect(externalRequests, 'Critical fixtures must be self-contained').toEqual([])
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          expect(overflow, 'Horizontal scrolling belongs inside the component').toBeLessThanOrEqual(1)
        }
        expect(errors).toEqual([])
        await expect(page).toHaveScreenshot(`${story.id}-${theme}-${viewportName}.png`, {
          fullPage: critical || story.id === 'workflows-framing-candidates--narrow-host',
        })
      })
    }
  }
}
