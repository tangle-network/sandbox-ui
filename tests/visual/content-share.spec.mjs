import { test, expect } from 'playwright/test'
import { openStory } from './story-ready.mjs'
import { CONTENT, contentShareFailures, measureContentShare } from './content-share.mjs'

// The run canvas and the agent workspace own the screen (Drew 11-06): measured here as disco.tangle.tools' proof
// measures its pages, so a component that pushes its content down fails before an app imports it.
const cases = [
  ['run-traceworkspace--grid-view', 'Live grid', '.ag-grid'],
  ['run-agentworkspace--files', 'Agent files', '.sandbox-code-view'],
  ['run-agentworkspace--trace', 'Agent trace', '[data-primary-content]'],
]
for (const [id, where, ready] of cases) {
  test(`${where} fills 1440x900`, async ({ page, baseURL }) => {
    await openStory(page, id, 'dark', { width: 1440, height: 900 }, baseURL)
    await page.locator(ready).first().waitFor()
    const measured = await measureContentShare(page, '#storybook-root', CONTENT)
    console.log(JSON.stringify({ kind: 'content-share', where, ...measured }))
    expect(contentShareFailures(where, measured)).toEqual([])
  })
}
