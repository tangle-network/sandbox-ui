/** Fresh installed Sandbox assets served by Runtime over real native workflow and supervisor files. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const consumer = process.env.RUNTIME_VIEWER_CONSUMER
assert.ok(consumer, 'Use a fresh installed package consumer, not source aliases')
const installed = createRequire(resolve(consumer, 'package.json'))
const { serveTopWeb } = await import(installed.resolve('@tangle-network/agent-runtime/tui'))
const assets = dirname(installed.resolve('@tangle-network/sandbox-ui/workspace-viewer.js'))
const output = process.env.RUNTIME_VIEWER_EVIDENCE
assert.ok(output, 'Keep the native browser proof outside the checkout')
await mkdir(output, { recursive: true })
const checks = [], browser = await chromium.launch({ headless: true })
try {
  // Runtime currently declares dark in its own shell; light is a separate host-theme integration precondition.
  for (const theme of ['dark']) for (const width of [1512, 390]) {
    const began = Date.now(), root = await mkdtemp(join(tmpdir(), 'sandbox-runtime-native-'))
    const workflow = join(root, 'workflow'), workspace = join(root, 'workspace'), supervisor = join(workspace, '.agent/supervisor/root')
    await mkdir(workflow); await mkdir(supervisor, { recursive: true })
    await writeFile(join(supervisor, 'state.json'), JSON.stringify({ id: 'root', status: 'done', task: 'Recorded supervisor', workspaceDir: workspace, budget: 0 }))
    const at = new Date().toISOString(), message = content => JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { role: 'assistant', content } }) + '\n'
    await writeFile(join(workspace, 'root-stream.jsonl'), JSON.stringify({ at, event: { kind: 'tool_call', toolCallId: 'root-tool', toolName: 'read', args: { path: 'recorded.txt' } } }) + '\n')
    await writeFile(join(workflow, 'journal.jsonl'), '{"type":"launched"}\n{"type":"started","agentId":"one","label":"Research"}\n')
    await writeFile(join(workflow, 'agent-one.jsonl'), message('Inspecting the native recorded work'))
    const web = await serveTopWeb({ roots: [workflow, workspace], assets })
    const context = await browser.newContext({ viewport: { width, height: 982 }, colorScheme: theme, recordVideo: { dir: output, size: { width, height: 982 } } })
    const page = await context.newPage(), errors = [], responses = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.url().startsWith(web.url)) responses.push({ url: response.url(), status: response.status() }) })
    try {
      assert.equal((await fetch(`${web.url}api/top`, { headers: { origin: 'https://other.example' } })).status, 403)
      assert.equal((await fetch(`${web.url}api/top`, { method: 'POST' })).status, 405)
      await page.goto(web.url)
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme)
      const card = page.locator('.ag-live-card').filter({ has: page.locator('.ag-live-name').getByText('Research', { exact: true }) })
      await card.waitFor()
      assert.equal(await page.getByRole('radio', { name: 'Graph', exact: true }).count(), 1)
      await card.click()
      const conversation = page.getByRole('complementary', { name: 'Research conversation' })
      await conversation.getByText('Inspecting the native recorded work', { exact: true }).waitFor()
      const written = Date.now()
      await appendFile(join(workflow, 'agent-one.jsonl'), message('A new native journal event reaches the selected conversation'))
      await conversation.getByText('Inspecting the native recorded workA new native journal event reaches the selected conversation', { exact: true }).waitFor()
      const visibleAfterMs = Date.now() - written
      assert.ok(visibleAfterMs < 4000, 'Native file arrival reaches the installed selected viewer within four seconds')
      await page.screenshot({ path: `${output}/native-transcript-${width}-${theme}.png`, fullPage: true })
      await page.reload()
      await card.waitFor()
      await card.click()
      await conversation.getByText('Inspecting the native recorded workA new native journal event reaches the selected conversation', { exact: true }).waitFor()
      await page.getByLabel('Run', { exact: true }).selectOption({ label: 'root' })
      await page.getByText('Recorded supervisor', { exact: true }).waitFor()
      assert.equal(await conversation.count(), 0, 'Changing roots closes the previously selected agent stream')
      await page.getByRole('button', { name: /^root, Done,/ }).click()
      await page.getByRole('complementary', { name: 'root conversation' }).getByText('recorded.txt', { exact: false }).first().waitFor()
      await page.screenshot({ path: `${output}/native-supervisor-${width}-${theme}.png`, fullPage: true })
      await page.getByLabel('Run', { exact: true }).selectOption({ label: 'workflow' })
      await appendFile(join(workflow, 'journal.jsonl'), '{"type":"result","agentId":"one","result":"Complete"}\n')
      await page.getByRole('button', { name: /^Research,.*Done/ }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.waitForTimeout(Math.max(0, 10100 - (Date.now() - began)))
      await web.close()
      await page.getByText('Finished · viewer closed', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      assert.deepEqual(responses.filter(response => response.status >= 400), [], 'Every real standalone asset and selected transcript URL resolves')
      checks.push({ theme, width, visibleAfterMs, result: 'PASS', transport: 'Runtime serveTopWeb over native files' })
    } catch (error) {
      await page.screenshot({ path: `${output}/failure-${width}-${theme}.png`, fullPage: true })
      await writeFile(`${output}/failure-${width}-${theme}.json`, JSON.stringify({ error: String(error), text: await page.locator('body').innerText(), errors, responses }, null, 2))
      throw error
    } finally { await web.close(); await context.close(); await rm(root, { recursive: true, force: true }) }
  }
} finally { await browser.close(); await writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2)) }
