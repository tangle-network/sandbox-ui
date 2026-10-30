/** Public packed hook over actual HTTP pages and native SSE; no substituted hook or transport. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { build } from 'vite'
import { chromium } from 'playwright'

const consumer = process.env.RUNTIME_VIEWER_CONSUMER
assert.ok(consumer, 'Use a fresh installed package consumer')
const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const row = (seq, text, extra = {}) => ({ seq, at: new Date(Date.UTC(2026, 9, 30, 0, 0, seq)).toISOString(), attempt: seq + 1, event: { kind: 'text_delta', text }, ...extra })
async function bundle(scratch) {
  const entry = resolve(scratch, 'history.jsx')
  await writeFile(entry, `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{useAgentStream}from'@tangle-network/sandbox-ui/run';
function Host(){const[alive,setAlive]=useState(true),[agent,setAgent]=useState('agent');const state=useAgentStream('/'+agent,undefined,{url:'/history?node='+agent,alive});return <><output data-state>{JSON.stringify(state)}</output><button onClick={()=>state.history?.beginningPage()}>Beginning</button><button onClick={()=>state.history?.latest()}>Latest</button><button onClick={()=>state.history?.older()}>Older</button><button onClick={()=>state.history?.newer()}>Newer</button><button onClick={()=>setAlive(false)}>Settle</button><button onClick={()=>{setAlive(false);setAgent('other')}}>Select other</button></>}createRoot(document.getElementById('host')).render(<Host/>);`)
  const built = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, lib: { entry, formats: ['es'], fileName: () => 'host.js' }, rollupOptions: { output: { chunkFileNames: 'host/[name]-[hash].js' } } } })
  return new Map((Array.isArray(built) ? built : [built]).flatMap(result => result.output).map(item => [item.fileName, item.type === 'chunk' ? item.code : item.source]))
}
function protocol(chunks) {
  const requests = [], clients = new Set()
  let rows = Array.from({ length: 2060 }, (_, seq) => row(seq, `Original row ${seq}`)), generation = 'original', alive = true, delay = 0
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/assets/')) { res.setHeader('content-type', 'text/javascript'); return res.end(chunks.get(url.pathname.slice(8))) }
    if (url.pathname === '/') return res.end('<!doctype html><div id="host"></div><script type="module" src="/assets/host.js"></script>')
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) })
    if (url.pathname === '/history') {
      if (url.searchParams.get('node') === 'other') return res.writeHead(403).end('refused')
      const limit = Number(url.searchParams.get('limit')), before = url.searchParams.get('before'), after = url.searchParams.get('after')
      const selected = before !== null ? rows.filter(item => item.seq < Number(before)).slice(-limit) : after !== null ? rows.filter(item => item.seq > Number(after)).slice(0, limit) : rows.slice(-limit)
      return setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ generation, events: selected, firstSeq: selected[0]?.seq ?? null, lastSeq: selected.at(-1)?.seq ?? null, hasEarlier: !!selected[0]?.seq, hasMore: !!selected.length && selected.at(-1).seq < rows.at(-1).seq, alive })) }, delay)
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); res.write(': connected\n\n')
    clients.add(res); res.on('close', () => clients.delete(res))
  })
  return { server, requests, clients, send(event, value) { for (const res of clients) res.write(frame(event, value)) }, close() { for (const res of clients) res.end() },
    reset(value, next) { generation = value; rows = next; this.send('reset', { generation }); this.send('rows', { generation, events: rows, lastSeq: rows.at(-1)?.seq, alive }) },
    settle() { alive = false; delay = 250 }, generation: () => generation }
}
const state = page => page.locator('[data-state]').textContent().then(JSON.parse)
const wait = (page, check) => page.waitForFunction(check)

test('packed bounded history keeps native cursor, identity, settlement and refusal semantics', { timeout: 90_000 }, async () => {
  const scratch = await mkdtemp(resolve(consumer, '.history-host-')), chunks = await bundle(scratch), wire = protocol(chunks)
  await new Promise(resolve => wire.server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true }), page = await browser.newPage()
  try {
    await page.goto(`http://127.0.0.1:${wire.server.address().port}/`)
    await wait(page, () => document.querySelector('[data-state]')?.textContent)
    assert.ok((await state(page)).history, 'the public hook owns actual bounded history, rather than a local consumer engine')
    await wait(page, () => { const s = JSON.parse(document.querySelector('[data-state]').textContent); return !s.history.loading && s.entries.length === 200 })
    assert.equal((await state(page)).entries[0].content, 'Original row 1860')
    assert.equal((await state(page)).lastSeq, 2059)
    const readCount = wire.requests.filter(item => item.path === '/history').length
    await page.waitForTimeout(1200)
    assert.equal(wire.requests.filter(item => item.path === '/history').length, readCount, 'a live tail does not poll HTTP')
    assert.equal(wire.clients.size, 1)
    await page.getByRole('button', { name: 'Older', exact: true }).click()
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).entries.length === 400)
    assert.equal((await state(page)).entries[0].content, 'Original row 1660')
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-state]').textContent).history.reading)
    assert.equal(wire.clients.size, 0, 'reading older history suspends the live connection')
    await page.getByRole('button', { name: 'Beginning', exact: true }).click()
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).entries[0]?.content === 'Original row 0')
    assert.equal((await state(page)).entries.length, 200)
    await page.getByRole('button', { name: 'Newer', exact: true }).click()
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).entries.length === 400)
    assert.equal((await state(page)).entries.at(-1).content, 'Original row 399')
    await page.getByRole('button', { name: 'Latest', exact: true }).click()
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).entries[0]?.content === 'Original row 1860')
    while (!wire.clients.size) await page.waitForTimeout(20)
    wire.reset('zero-generation', [row(0, 'Sequence zero survives')])
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).entries[0]?.content === 'Sequence zero survives')
    wire.close()
    await page.waitForTimeout(1250)
    assert.equal(wire.requests.filter(item => item.path === '/agent').at(-1).query.after, '0', 'reconnect includes the actual zero cursor')
    assert.equal(wire.requests.filter(item => item.path === '/agent').at(-1).query.generation, 'zero-generation')
    wire.send('rows', { generation: 'zero-generation', events: [row(1, '', { stream: 'a', attempt: 1, event: { kind: 'tool_call', toolCallId: 'same', toolName: 'bash', args: { command: 'first' } } }), row(2, '', { stream: 'a', attempt: 1, event: { kind: 'tool_result', toolCallId: 'same', result: { error: 'first failed' } } }), row(3, '', { stream: 'a', attempt: 2, event: { kind: 'tool_call', toolCallId: 'same', toolName: 'read' } }), row(4, '', { stream: 'a', attempt: 2, event: { kind: 'tool_result', toolCallId: 'same', result: 'second succeeded' } }), row(5, '', { stream: 'b', attempt: 1, event: { kind: 'tool_call', toolCallId: 'same', toolName: 'bash' } }), row(6, '', { stream: 'b', attempt: 1, event: { kind: 'tool_result', toolCallId: 'same', result: { isError: true, error: 'other session failed' } } })], lastSeq: 6, alive: true })
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).lastSeq === 6)
    const tools = (await state(page)).entries.filter(item => item.kind === 'tool')
    assert.equal(tools.length, 3); assert.equal(new Set(tools.map(item => item.id)).size, 3)
    assert.deepEqual(tools.map(item => item.call.status), ['error', 'success', 'error'])
    assert.ok(tools[0].call.output.includes('first failed') && tools[2].call.output.includes('other session failed'))
    wire.reset('bounded', Array.from({ length: 2005 }, (_, seq) => row(seq, `Bounded row ${seq}`)))
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).lastSeq === 2004)
    assert.equal((await state(page)).entries.length, 2000); assert.equal((await state(page)).entries[0].content, 'Bounded row 5')
    const retained = (await state(page)).entries.map(item => item.id)
    wire.settle(); await page.getByRole('button', { name: 'Settle', exact: true }).click()
    assert.deepEqual((await state(page)).entries.map(item => item.id), retained, 'alive-to-settled preserves the existing window while the final HTTP read is pending')
    await wait(page, () => !JSON.parse(document.querySelector('[data-state]').textContent).alive)
    assert.deepEqual((await state(page)).entries.map(item => item.id), retained)
    await page.getByRole('button', { name: 'Select other', exact: true }).click()
    await wait(page, () => JSON.parse(document.querySelector('[data-state]').textContent).error?.includes('HTTP 403'))
    const refused = await state(page)
    assert.equal(refused.entries.length, 0); assert.equal(refused.history.loading, false)
    assert.equal(wire.clients.size, 0)
  } finally { wire.close(); await browser.close(); await new Promise(resolve => wire.server.close(resolve)); await rm(scratch, { recursive: true, force: true }) }
})
