/** Actual installed viewer over HTTP: account changes and revoked retained resources lose authority. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { build } from 'vite'
import { chromium } from 'playwright'

const consumer = process.env.RUNTIME_VIEWER_CONSUMER
assert.ok(consumer, 'Use the fresh installed shared-package consumer')
const require = createRequire(resolve(consumer, 'package.json'))
const assets = dirname(require.resolve('@tangle-network/sandbox-ui/workspace-viewer.js'))
const evidence = process.env.RUNTIME_AUTHORITY_EVIDENCE
let documentEntry = '@tangle-network/sandbox-ui/hooks/use-document'
try { require.resolve(documentEntry) } catch { documentEntry = '@tangle-network/sandbox-ui/hooks' }

async function openHost() {
  const scratch = await mkdtemp(resolve(consumer, '.authority-host-'))
  const entry = resolve(scratch, 'host.js')
  await writeFile(entry, `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{LiveRun}from'@tangle-network/sandbox-ui/run/live';import{useDocument}from'${documentEntry}';
const transport=account=>({fetch:(url,init)=>fetch(url,{...init,headers:{...init?.headers,'X-Account':account}}),openEventSource:url=>new EventSource(url+'?account='+account)});const A=transport('A'),B=transport('B');
function Probe({transport}){const doc=useDocument('/probe',undefined,true,transport.fetch);return React.createElement('output',{'aria-label':'Document authority'},doc.data?.owner??doc.error??'Loading document')}
function Host(){const[t,set]=useState(A);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>set(B)},'Switch account'),React.createElement(Probe,{transport:t}),React.createElement(LiveRun,{api:'/api',transport:t}))}createRoot(document.getElementById('host')).render(React.createElement(Host));`)
  const module = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, lib: { entry, formats: ['es'], fileName: () => 'host.js' }, rollupOptions: { output: { chunkFileNames: 'host/[name]-[hash].js' } } } })
  const chunks = new Map((Array.isArray(module) ? module : [module]).flatMap(result => result.output).map(item => [item.fileName, item.type === 'chunk' ? item.code : item.source]))
  const requests = [], clients = new Set()
  let inventoryStatus = 200, fileStatus = 200, delayedProbe, delayedEvents
  const content = 'Private A retained bytes\n', hash = createHash('sha256').update(content).digest('hex')
  const frame = account => `event: snapshot\ndata: ${JSON.stringify({ sequence: 1, observedAt: Date.now(), reset: true, snapshots: [{ root: account, generatedAt: Date.now(), completeness: 'complete', diagnostics: [], supervisors: [{ id: `run-${account}`, status: 'running', task: `Private ${account} task`, startedAt: new Date().toISOString(), workers: [{ id: `worker-${account}`, label: `${account} worker`, status: 'running', startedAt: new Date().toISOString() }] }] }] })}\n\nevent: end\ndata: {}\n\n`
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'), path = url.pathname, account = req.headers['x-account'] ?? url.searchParams.get('account')
    const json = (data, status = 200, etag) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); if (etag) res.setHeader('ETag', etag); res.end(status === 304 ? undefined : JSON.stringify(data)) }
    requests.push({ path, account, etag: req.headers['if-none-match'] })
    if (path === '/probe') {
      if (account === 'B') { delayedProbe = res; return }
      return json({ owner: 'Private A document' }, 200, '"probe-A"')
    }
    if (path === '/api/events') {
      res.setHeader('content-type', 'text/event-stream'); res.flushHeaders()
      if (account === 'A') return res.end(frame('A'))
      clients.add(res); delayedEvents = res; res.on('close', () => clients.delete(res)); return
    }
    if (path.endsWith('/stream')) { res.setHeader('content-type', 'text/event-stream'); return res.end('event: end\ndata: {}\n\n') }
    if (path.startsWith('/api/agents/')) {
      const status = account === 'A' ? path.endsWith('/file') ? fileStatus : inventoryStatus : 403
      const etag = path.endsWith('/file') ? '"file-A"' : '"inventory-A"'
      if (status !== 200) return json({ reason: `Resource refused: ${status}` }, status)
      if (req.headers['if-none-match'] === etag) return json(null, 304, etag)
      return json({ coverage: { status: 'complete', source: 'actual-http' }, files: { scope: 'workspace', complete: true, entries: [{ path: 'private.txt', sha256: hash, byteLength: Buffer.byteLength(content) }] }, ...(path.endsWith('/file') ? { file: { path: 'private.txt', content, sha256: hash, byteLength: Buffer.byteLength(content) } } : {}) }, 200, etag)
    }
    if (path === '/styles.css') { res.setHeader('content-type', 'text/css'); return res.end(await readFile(resolve(assets, 'styles.css'))) }
    const chunk = chunks.get(path.slice(1)); if (chunk !== undefined) { res.setHeader('content-type', path.endsWith('.css') ? 'text/css' : 'text/javascript'); return res.end(chunk) }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html class="dark" data-theme="dark"><link rel="stylesheet" href="/styles.css"><div id="host"></div><script type="module" src="/host.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  if (evidence) await mkdir(evidence, { recursive: true })
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(evidence ? { recordVideo: { dir: evidence, size: { width: 1280, height: 900 } } } : {}) })
  await context.addInitScript(() => {
    window.authorityUrls = { created: [], revoked: [] }
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = value => { const url = create(value); window.authorityUrls.created.push(url); return url }
    URL.revokeObjectURL = url => { window.authorityUrls.revoked.push(url); return revoke(url) }
  })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('button', { name: /^A worker,/ }).click()
  await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
  await page.getByRole('region', { name: 'Retained files', exact: true }).getByText(content.trim(), { exact: true }).waitFor()
  await page.getByText('Provenance', { exact: true }).click()
  await page.getByRole('link', { name: 'Download', exact: true }).waitFor()
  return {
    page, requests, content,
    refuse: (target, status) => { if (target === 'file') fileStatus = status; else inventoryStatus = status },
    releaseB: () => { delayedProbe.writeHead(403, { 'content-type': 'application/json' }); delayedProbe.end('{"reason":"B refused"}'); delayedEvents.end(frame('B')) },
    capture: async name => { if (evidence) { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true }) } },
    close: async () => { await browser.close(); for (const client of clients) client.end(); delayedProbe?.end(); await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true }) },
  }
}

test('same API switches account before new evidence or a refusal can expose old scope', { timeout: 90_000 }, async () => {
  const host = await openHost(), { page } = host
  try {
    await page.getByText('Finished · viewer closed', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Switch account', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('main.ws-live')?.textContent.includes('Private A task'), null, { timeout: 5000 })
    assert.equal(await page.getByRole('link', { name: 'Download', exact: true }).count(), 0)
    assert.equal(await page.getByText('Private A document', { exact: true }).count(), 0, 'The shared document hook discards old-account data even with keepPrevious')
    assert.equal(await page.getByText('Finished · viewer closed', { exact: true }).count(), 0)
    await page.waitForFunction(() => window.authorityUrls.created.every(url => window.authorityUrls.revoked.includes(url)))
    await page.waitForTimeout(200)
    const b = host.requests.filter(request => request.account === 'B')
    assert.ok(b.some(request => request.path === '/probe'))
    assert.ok(b.every(request => request.etag === undefined), 'New account requests never carry A entity tags')
    await host.capture('account-b-before-evidence')
    host.releaseB()
    await page.getByLabel('Document authority', { exact: true }).getByText('B refused', { exact: true }).waitFor()
    await page.getByText('Private B task', { exact: true }).waitFor()
    assert.equal(await page.getByText('Private A document', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('link', { name: 'Download', exact: true }).count(), 0)
    await host.capture('account-b-refused')
  } finally { await host.close() }
})

test('inventory and file refusals remove preview, complete coverage and download, then recover', { timeout: 120_000 }, async () => {
  const host = await openHost(), { page } = host
  try {
    const files = page.getByRole('region', { name: 'Retained files', exact: true })
    for (const target of ['file', 'inventory']) for (const status of [401, 403, 404]) {
      const created = await page.evaluate(() => [...window.authorityUrls.created])
      host.refuse(target, status)
      await page.getByRole('alert').filter({ hasText: `Resource refused: ${status}` }).waitFor({ timeout: 8000 })
      assert.equal(await page.getByRole('link', { name: 'Download', exact: true }).count(), 0)
      assert.equal(await files.getByText(host.content.trim(), { exact: true }).count(), 0)
      if (target === 'inventory') assert.equal(await page.getByText('Conversation retained', { exact: true }).count(), 0)
      await page.waitForFunction(urls => urls.every(url => window.authorityUrls.revoked.includes(url)), created)
      await host.capture(`${target}-refused-${status}`)
      host.refuse(target, 200)
      await files.getByText(host.content.trim(), { exact: true }).waitFor({ timeout: 8000 })
      if (!await page.getByRole('link', { name: 'Download', exact: true }).count()) await page.getByText('Provenance', { exact: true }).click()
      const download = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download', exact: true }).click()]).then(([value]) => value)
      assert.equal(await readFile(await download.path(), 'utf8'), host.content)
    }
    assert.ok(host.requests.some(request => request.etag === '"inventory-A"'), 'Valid retained inventory uses real 304 revalidation')
    await host.capture('recovered-retained-files')
  } finally { await host.close() }
})
