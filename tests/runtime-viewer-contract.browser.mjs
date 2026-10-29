/** Original real HTTP lifecycle, unknown/failure, selected transcript and navigation/camera contracts moved with LiveRun. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const consumer = process.env.RUNTIME_VIEWER_CONSUMER
assert.ok(consumer, 'Use the fresh installed shared package consumer')
const require = createRequire(resolve(consumer, 'package.json'))
const { chromium } = await import('playwright')
const assets = dirname(require.resolve('@tangle-network/sandbox-ui/workspace-viewer.js'))
const now = Date.now(), start = now - 30 * 60_000, iso = at => new Date(at).toISOString()
const failureReason = 'Checkout tests failed: ' + 'The retained integration output identifies a mismatched response shape and preserves the complete recorded explanation. '.repeat(4).trimEnd()
const nodes = Array.from({ length: 17 }, (_, i) => ({
  id: i ? `lane-g:s${i}` : 'lane-g', label: i ? `Agent ${i}` : 'Root', role: null, assignment: null,
  harness: 'codex', model: 'openai/gpt-5.5', status: i === 1 ? 'needs-you' : i === 2 ? 'failed' : i === 4 ? 'waiting' : 'running',
  start: iso(start + i * 1000), end: i === 2 ? iso(now - 60_000) : null,
  failureReason: i === 2 ? failureReason : null,
  turn: i === 1 ? 'Approve the proposed change' : i === 2 ? 'Checkout tests failed' : i === 4 ? 'Waiting on Agent 5' : 'Checking recorded evidence',
  lastAt: iso(i === 3 ? now - 12 * 60_000 : now - 2000), shipped: i === 2 ? 1 : 0, hasCode: false,
  usage: { billedUsd: null, listUsd: null, listComplete: false, calls: i === 15 ? 0 : 300, tools: { read: { calls: 500, failures: i === 2 ? 1 : 0, ms: 2000 } }, pricedCalls: null, tokens: null, at: iso(now), source: 'browser-fixture', lastActivityAt: i === 3 ? now - 12 * 60_000 : now - 2000, medianEventGapMs: 30_000, activityEvents: [{ id: `event:${i}`, label: i === 2 ? 'Checkout tests failed' : 'read · retained evidence', at: i === 3 ? now - 12 * 60_000 : now - 2000 }], steps: [
    ...(i === 15 ? [] : [{ kind: 'model', startMs: i === 3 ? now - 14 * 60_000 : now - 5000, endMs: i === 3 ? now - 13 * 60_000 : now - 4000, modelCalls: 300, failed: false }]),
    { kind: 'tool', startMs: i === 3 ? now - 13 * 60_000 : now - 4000, endMs: i === 3 ? now - 12 * 60_000 : now - 2000, failed: i === 2, tool: 'read', name: i === 2 ? 'Checkout tests failed' : 'Read retained evidence' },
  ] },
}))
nodes[16].usage = null
const workspace = { schema: 'agent-workspace.run-workspace.v1', runId: 'lane-g', live: true, nodes, edges: nodes.slice(1).map(n => ({ from: 'lane-g', to: n.id, kind: 'spawn' })), releases: [], best: null, code: { available: false, reason: 'Fixture has no code' } }
workspace.edges = workspace.edges.filter(edge => edge.to !== 'lane-g:s16')
const run = { schema: 'agent-workspace.run.v1', run: { id: 'lane-g', play: 'lane-g', state: 'running', startedAt: iso(start), location: { kind: 'dir', path: null }, record: { status: 'missing', digest: null } }, input: null, spend: { nodes: {}, paidUsd: null }, versions: [], live: { polling: true, mirrorAt: null }, execution: { alive: true } }

test('installed Runtime view preserves failure and unknown lifecycle evidence across four host theme/viewport states', { timeout: 120_000 }, async () => {
  const evidence = process.env.RUN_UI_EVIDENCE_DIR
  if (evidence) await mkdir(evidence, { recursive: true })
  let theme = 'dark', runtimeTotals, runtimeOutcome
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const json = data => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)) }
    if (path.startsWith('/api/agents/')) {
      res.setHeader('content-type', 'text/event-stream')
      return res.end(`event: rows\ndata: ${JSON.stringify({ generation: 'fixture', alive: false, events: [{ seq: 1, at: iso(now - 1000), event: { kind: 'text', text: 'Recorded response from the worker without a start timestamp.' } }] })}\n\nevent: end\ndata: {}\n\n`)
    }
    if (path === '/api/events') {
      res.setHeader('content-type', 'text/event-stream')
      const snapshot = { root: 'fixture', generatedAt: now, completeness: 'complete', diagnostics: [], supervisors: [{ id: 'lane-g', totals: runtimeTotals, ...(runtimeOutcome ? { outcome: runtimeOutcome } : {}), status: runtimeOutcome ? runtimeOutcome.kind === 'winner' ? 'done' : runtimeOutcome.kind : 'running', startedAt: iso(start), lastActivityAt: now - 2000, medianEventGapMs: 30_000, workers: nodes.slice(1).map(n => ({ id: n.id, parent: 'lane-g', label: n.label, status: n.status === 'failed' ? 'down' : n.status, runtime: n.harness, startedAt: n.id.endsWith(':s15') ? undefined : n.start, endedAt: n.end ?? undefined, lastActivityAt: Date.parse(n.lastAt), medianEventGapMs: 30_000, liveTail: [n.turn], reason: n.failureReason ?? undefined })) }] }
      snapshot.supervisors[0].workers = snapshot.supervisors[0].workers.filter(worker => worker.id !== 'lane-g:s16')
      for (const worker of snapshot.supervisors[0].workers) delete worker.parent
      snapshot.pursuit = { nodes: [{ id: 'lane-g:s16', runId: 'lane-g', parentId: 'lane-g', label: 'Agent 16' }] }
      return res.end(`event: snapshot\ndata: ${JSON.stringify({ sequence: 1, observedAt: now, reset: true, snapshots: [snapshot] })}\n\nevent: end\ndata: {}\n\n`)
    }
    if (path.endsWith('/workspace')) return json(workspace)
    if (path === '/api/runs/lane-g') return json(run)
    if (path.startsWith('/api/plays/')) return json({ id: 'lane-g', runs: [] })
    if (path.startsWith('/assets/')) {
      const file = resolve(assets, path.slice(8))
      if (!file.startsWith(assets + '/')) return res.writeHead(400).end()
      try { res.setHeader('content-type', extname(file) === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'); return res.end(await readFile(file)) } catch { return res.writeHead(404).end() }
    }
    if (path.startsWith('/run/lane-g') || path === '/live') {
      res.setHeader('content-type', 'text/html; charset=utf-8')
      // Discovery's maintained shell owns these run-page gutters; Runtime LiveRun owns its own padding.
      return res.end(`<!doctype html><html class="${theme}" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/styles.css"><style>#agent-workspace[data-mode="run"]{padding:0 1.25rem 2rem}@media(max-width:600px){#agent-workspace[data-mode="run"]{padding-left:16px;padding-right:16px}}</style><div id="agent-workspace" data-mode="${path === '/live' ? 'live' : 'run'}" data-id="lane-g" data-api="/api"></div><script type="module" src="/assets/workspace-viewer.js"></script></html>`)
    }
    res.writeHead(404).end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    for (theme of ['dark', 'light']) for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, ...(evidence ? { recordVideo: { dir: evidence, size: { width, height: 900 } } } : {}) })
      const page = await context.newPage(), errors = []
      const cardNamed = name => page.locator('.ag-live-card').filter({ has: page.locator('.ag-live-name').filter({ hasText: new RegExp(`\\b${name}$`) }) })
      const choose = async name => {
        await page.getByRole('button', { name: 'Go to agent', exact: true }).click()
        await page.locator('.rp-lb input').fill(name)
        await page.getByRole('option', { name: `${name} —`, exact: true }).click()
        await cardNamed(name).waitFor()
      }
      const fit = async () => { await page.locator('.react-flow__controls-fitview, .ag-phone-select').first().waitFor(); const button = page.getByRole('button', { name: 'Fit View', exact: true }); if (await button.count()) await button.click() }
      const capture = async name => { if (!evidence) return; await page.evaluate(async () => { const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)); await Promise.allSettled(finite.map(animation => animation.finished)) }); await page.screenshot({ path: `${evidence}/${name}-${theme}-${width}.png`, fullPage: true }) }
      const countIn = (inspector, label) => inspector.locator('.rp-stat3 > div').filter({ has: page.getByText(new RegExp(`^${label.replace(/s$/, 's?')}$`)) }).locator('b')
      page.on('pageerror', error => errors.push(error.message))
      runtimeTotals = undefined
      await page.goto(`http://127.0.0.1:${server.address().port}/live`)
      await page.locator('.ws-live .ag-live-card[data-status="needs-you"]').waitFor()
      assert.equal(await page.getByRole('radio', { name: 'Graph', exact: true }).count(), 1, 'One canonical graph mode control')
      assert.match(await page.locator('.ws-live .ag-live-card[data-status="failed"]').innerText(), /Checkout tests failed/)
      await page.locator('.ws-live .ag-live-card[data-status="failed"]').click()
      const recordedFailure = page.getByRole('complementary', { name: 'Agent 2 conversation' }).getByText(failureReason, { exact: true })
      await recordedFailure.waitFor()
      await recordedFailure.scrollIntoViewIfNeeded()
      assert.equal(await recordedFailure.evaluate(node => node.scrollHeight <= node.clientHeight), true, 'The complete recorded reason remains readable even when the transcript does not repeat it')
      await capture('runtime-failure-details')
      await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
      await fit()
      assert.ok(await page.locator('.ws-live [data-activity="quiet"]').count())
      assert.equal(await cardNamed('Agent 16').getAttribute('data-status'), 'unknown', 'An identity without a recorded lifecycle stays unknown')
      assert.equal(await cardNamed('Agent 15').count(), 1, 'A recorded worker with no start timestamp keeps its card')
      await cardNamed('Agent 15').click()
      await page.getByRole('complementary', { name: 'Agent 15 conversation' }).getByText('Recorded response from the worker without a start timestamp.', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
      await fit()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
      await page.getByLabel('Graph layout', { exact: true }).selectOption('hub')
      await page.locator('.ag-stats').waitFor()
      assert.equal(await page.locator('.ag-canvas .ag-node').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).position === 'absolute')), true, 'The host cannot move shared Hub nodes into normal document flow')
      assert.equal(await page.locator('.ag-stats > span').nth(1).locator('b').innerText(), '—', 'Unreported tool inventory is unknown in the actual Runtime Hub')
      assert.equal(await page.locator('.ag-stats > span').nth(2).locator('b').innerText(), '—', 'An unreported call history cannot certify zero calls per minute')
      await capture('runtime-unknown-hub')
      const hubHeader = await page.locator('.ag-head').evaluate(header => { const box = header.getBoundingClientRect(); return { header: box.toJSON(), height: getComputedStyle(header).height, flexShrink: getComputedStyle(header).flexShrink, metrics: [...header.querySelectorAll('.ag-stats > span')].map(node => ({ text: node.textContent, ...node.getBoundingClientRect().toJSON() })), canvas: header.nextElementSibling.getBoundingClientRect().toJSON() } })
      console.log('Runtime Hub header geometry', JSON.stringify({ theme, width, ...hubHeader }))
      assert.ok(hubHeader.metrics.every(metric => metric.width > 0 && metric.left >= hubHeader.header.left && metric.right <= hubHeader.header.right && metric.top >= hubHeader.header.top && metric.bottom <= hubHeader.header.bottom && metric.bottom <= hubHeader.canvas.top), 'Every Hub metric must remain visible inside the wrapped header above the canvas')
      await page.getByLabel('Graph layout', { exact: true }).selectOption('tree')
      await fit() // The layout change retains the focused agent; inspect the complete graph explicitly.
      try { await page.locator('.ws-live .ag-live-card[data-status="failed"]').waitFor() } catch (error) {
        if (evidence) {
          await page.screenshot({ path: `${evidence}/tree-return-failure-${theme}-${width}.png`, fullPage: true })
          await (await import('node:fs/promises')).writeFile(`${evidence}/tree-return-failure-${theme}-${width}.html`, await page.content())
        }
        console.log('Tree return diagnosis', JSON.stringify(await page.evaluate(() => ({ layout: document.querySelector('[aria-label="Graph layout"]')?.value, camera: document.querySelector('.react-flow__viewport')?.getAttribute('style'), selected: [...document.querySelectorAll('[data-agent-id][aria-pressed="true"],.react-flow__node.selected')].map(node => node.getAttribute('data-agent-id') ?? node.getAttribute('data-id')), nodes: [...document.querySelectorAll('.ws-live .react-flow__node')].map(node => ({ id: node.dataset.id, text: node.textContent, status: node.querySelector('[data-status]')?.getAttribute('data-status'), className: node.className })), caption: document.querySelector('.ws-live')?.textContent?.slice(0, 500) }))))
        throw error
      }
      await capture('runtime-sse-fixture')
      await page.getByRole('radio', { name: 'Agents', exact: true }).click()
      await page.locator('.fw-root').waitFor()
      assert.equal(await page.locator('.fw-row[data-span-id="lane-g"][data-slowest]').count(), 0, 'The owning supervisor is excluded from leaf comparisons')
      assert.equal(await page.locator('.fw-row[data-span-id="lane-g"] .fw-badge').count(), 0)
      assert.ok(await page.getByTitle('Tokens not reported', { exact: true }).count(), 'Unreported Runtime usage stays unknown')
      assert.ok(await page.getByTitle('Model calls not reported', { exact: true }).count())
      assert.ok(await page.getByTitle('Tool calls not reported', { exact: true }).count())
      runtimeTotals = { tokensInput: 0, tokensOutput: 0, tokensKnown: true }
      await page.reload()
      await page.getByRole('radio', { name: 'Agents', exact: true }).click()
      await page.locator('.fw-root').waitFor()
      assert.ok(await page.getByTitle('0 tokens', { exact: true }).count(), 'Authoritative measured zero is retained')
      assert.equal(await page.getByTitle('Tokens not reported', { exact: true }).count(), 0)
      runtimeOutcome = { kind: 'no-winner', reason: 'no-result-selected' }
      await page.reload()
      await page.locator('[data-run-outcome="no-winner"]').getByText('No winner: no-result-selected', { exact: true }).waitFor()
      const rootNode = page.getByRole('button', { name: /^root,/ })
      await rootNode.waitFor()
      assert.match(await rootNode.getAttribute('aria-label'), /Stopped.*No winner: no-result-selected/)
      assert.doesNotMatch(await rootNode.getAttribute('aria-label'), /Done/)
      assert.equal(await page.locator('[data-recorded-route]').count(), 0, 'An old no-winner result does not manufacture retrospective stop or code evidence')
      runtimeOutcome = { kind: 'failed', reason: 'Recorded provider refusal: native capture unavailable' }
      await page.reload()
      await page.locator('[data-run-outcome="failed"]').getByText('Failed: Recorded provider refusal: native capture unavailable', { exact: true }).waitFor()
      await rootNode.waitFor()
      assert.match(await rootNode.getAttribute('aria-label'), /Failed.*Recorded provider refusal: native capture unavailable/)
      runtimeOutcome = undefined
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})


test('same-account navigation resets a finished API while same-API frames preserve selection', { timeout: 60_000 }, async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { build } = await import('vite')
  const evidence = process.env.RUN_UI_EVIDENCE_DIR
  if (evidence) await mkdir(evidence, { recursive: true })
  const scratch = await mkdtemp(resolve(consumer, '.navigation-consumer-'))
  const clients = new Set()
  const frame = (id, status, sequence) => `event: snapshot\ndata: ${JSON.stringify({ sequence, observedAt: now, reset: sequence === 1, snapshots: [{ root: id, generatedAt: now, completeness: 'complete', diagnostics: [], supervisors: [{ id, status, task: `Inspect ${id}`, startedAt: iso(start), workers: [{ id: `${id}-worker`, label: `${id} worker`, status, startedAt: iso(start), runtime: 'codex', liveTail: ['Actual HTTP fixture input'] }] }] }] })}\n\n`
  const entry = resolve(scratch, 'navigation.js')
  await writeFile(entry, `import { createElement, useState } from 'react'; import { createRoot } from 'react-dom/client'; import { LiveRun } from '@tangle-network/sandbox-ui/run/live'; function Host(){ const [api,setApi]=useState('/a'); return createElement('div',{},createElement('button',{onClick:()=>setApi('/b')},'Open run B'),createElement(LiveRun,{api})); } createRoot(document.getElementById('navigation')).render(createElement(Host));`)
  let browser, bResponse, admitB
  const bReady = new Promise(resolve => { admitB = resolve })
  const module = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, lib: { entry, formats: ['es'], fileName: () => 'navigation.js', cssFileName: 'navigation' }, rollupOptions: { output: { chunkFileNames: 'navigation/[name]-[hash].js' } } } })
  const chunks = new Map((Array.isArray(module) ? module : [module]).flatMap(output => output.output).map(output => [output.fileName, output.type === 'chunk' ? output.code : output.source]))
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/a/events' || path === '/b/events') {
      res.setHeader('content-type', 'text/event-stream'); res.setHeader('cache-control', 'no-cache'); res.flushHeaders()
      if (path === '/a/events') return res.end(frame('run-A', 'succeeded', 1) + 'event: end\ndata: {}\n\n')
      clients.add(res); bResponse = res; admitB(res); res.write(': connected\n\n'); res.on('close', () => clients.delete(res)); return
    }
    if (path.endsWith('/stream')) { res.setHeader('content-type', 'text/event-stream'); return res.end('event: end\ndata: {}\n\n') }
    if (/^\/[ab]\/agents\//.test(path)) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ coverage: { status: 'missing', source: 'actual-http-fixture', reason: 'No native transcript is supplied' } })) }
    if (path === '/assets/styles.css') { res.setHeader('content-type', 'text/css'); return res.end(await readFile(resolve(assets, 'styles.css'))) }
    const chunk = chunks.get(path.slice(1)); if (chunk !== undefined) { res.setHeader('content-type', path.endsWith('.css') ? 'text/css' : 'text/javascript'); return res.end(chunk) }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html class="dark" data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/styles.css"><div id="navigation"></div><script type="module" src="/navigation.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(evidence ? { recordVideo: { dir: evidence, size: { width: 1280, height: 900 } } } : {}) })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/navigation`)
    await page.getByText('Finished · viewer closed', { exact: true }).waitFor()
    await page.getByText('Inspect run-A', { exact: true }).waitFor()
    if (evidence) await page.screenshot({ path: `${evidence}/navigation-a-finished.png`, fullPage: true })
    await page.getByRole('button', { name: 'Open run B', exact: true }).click()
    const liveB = page.locator('main.ws-live[data-api="/b"]')
    await liveB.waitFor()
    assert.equal(await liveB.getByText('Finished · viewer closed', { exact: true }).count(), 0, 'New API must not retain the previous run terminal state')
    assert.equal(await liveB.getByText('Inspect run-A', { exact: true }).count(), 0, 'New API must not retain the previous run snapshot')
    if (evidence) await page.screenshot({ path: `${evidence}/navigation-b-before-frame.png`, fullPage: true })
    await bReady
    assert.ok(bResponse, 'The actual B event stream must be connected')
    bResponse.write(frame('run-B', 'running', 1))
    await page.getByText('Inspect run-B', { exact: true }).waitFor()
    const node = page.locator('.react-flow__node[data-id="run-B-worker"]')
    await node.waitFor(); await node.click()
    await page.getByRole('complementary', { name: 'run-B worker conversation', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
    const camera = await page.locator('.react-flow__viewport').getAttribute('style')
    bResponse.write(frame('run-B', 'running', 2))
    await page.waitForFunction(() => document.querySelector('main.ws-live')?.getAttribute('data-top-sequence') === '2')
    assert.equal(await page.locator('.react-flow__node[data-id="run-B-worker"]').getAttribute('aria-pressed'), 'true')
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'), camera, 'Same API updates preserve the existing graph camera')
    assert.equal(await page.getByText('Inspect run-A', { exact: true }).count(), 0)
    if (evidence) await page.screenshot({ path: `${evidence}/navigation-b-live.png`, fullPage: true })
    await context.close()
  } finally { await browser?.close(); for (const response of clients) response.end(); await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true }) }
})


