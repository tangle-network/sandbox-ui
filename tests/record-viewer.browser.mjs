import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import { build } from 'vite'
import { chromium } from 'playwright'

// The published UCS(C5*C5) record at its immutable blog revision: one agent, three hours, a reprompted attempt.
const SOURCE = 'https://raw.githubusercontent.com/drewstone/drewstone.github.io/1996e808ae73234ca4146c01b2853f3bd851635e/public/research/records/research-math-20261003system4.json'
const DIGEST = '00dfd133144f2f3c90ec540988b4527666902d444edf0a953846bebf818b2a50'
const BANNED = ['Unknown', ' — ', 'Returned', 'contract', '…', 'NaN', 'undefined']

test('the record view tells a published run as a story at desktop and phone widths', { timeout: 150_000 }, async () => {
  const manifest = process.env.SANDBOX_UI_PACKAGE ?? resolve('package.json')
  const require = createRequire(manifest)
  const styles = require.resolve('@tangle-network/sandbox-ui/styles')
  const response = await fetch(SOURCE)
  assert.equal(response.ok, true, 'the immutable published record remains readable')
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(createHash('sha256').update(bytes).digest('hex'), DIGEST)
  const scratch = await mkdtemp(resolve(dirname(manifest), '.record-host-')), entry = resolve(scratch, 'host.js')
  await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import{AgentRecord}from'@tangle-network/sandbox-ui/record';import{parseRecord}from'@drewstone/agent-record/record';
const record=parseRecord(await fetch('/record.json').then(response=>response.json()));
createRoot(document.getElementById('host')).render(React.createElement(AgentRecord,{records:[record],onSelectionChange:selection=>{window.selected=selection}}))`)
  const built = await build({ root: dirname(manifest), configFile: false, logLevel: 'silent', resolve: { dedupe: ['react', 'react-dom'] }, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, lib: { entry, formats: ['es'], fileName: () => 'host.js' }, rollupOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } } } })
  const chunks = new Map((Array.isArray(built) ? built : [built]).flatMap(result => result.output).map(item => [item.fileName, item.type === 'chunk' ? item.code : item.source]))
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/record.json') { res.setHeader('content-type', 'application/json'); return res.end(bytes) }
    if (path === '/styles.css') { res.setHeader('content-type', 'text/css'); return res.end(await readFile(styles)) }
    const chunk = chunks.get(path.slice(1))
    if (chunk !== undefined) { res.setHeader('content-type', 'text/javascript'); return res.end(chunk) }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><body style="margin:0;padding:0 16px"><div id="host"></div><script type="module" src="/host.js"></script></body></html>')
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const evidence = process.env.RUN_UI_EVIDENCE_DIR
  if (evidence) await mkdir(evidence, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.goto(`http://127.0.0.1:${server.address().port}/`)
      await page.locator('.rv-title').waitFor({ timeout: 15_000 })
      const view = page.locator('.agent-record')
      const text = await view.innerText()
      assert.match(text, /Result accepted on attempt 2; finished 19:35 UTC\./)
      assert.match(text, /\$25\.89 at list price, not billed/)
      assert.match(text, /138 steps, no errors/)
      assert.match(text, /Download the record\s+JSON, \d+ KB/)
      for (const banned of BANNED) assert.equal(text.includes(banned), false, `${theme} ${width}: the view prints "${banned}"`)
      const frame = await page.evaluate(() => {
        const small = [...document.querySelectorAll('.agent-record *')].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && parseFloat(getComputedStyle(element).fontSize) < 12 && !element.closest('svg'))
        const clamped = [...document.querySelectorAll('.agent-record *')].filter(element => { const style = getComputedStyle(element); return (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') && !element.closest('.rv-command-wrap') })
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: small.map(element => element.className), clamped: clamped.map(element => element.className) }
      })
      assert.equal(frame.overflow, 0, `${theme} ${width}: no horizontal scroll`)
      assert.deepEqual(frame.small, [], `${theme} ${width}: no text under 12 px`)
      assert.deepEqual(frame.clamped, [], `${theme} ${width}: only commands clamp`)
      const claim = page.locator('.rv-claim .rv-link')
      await claim.hover()
      assert.equal(await claim.evaluate(element => getComputedStyle(element).textDecorationLine), 'none', 'links never underline on hover')
      if (evidence) await page.screenshot({ path: `${evidence}/record-${theme}-${width}.png`, fullPage: true })
      // The claim opens the episode holding the page and the page's step.
      await claim.click()
      const opened = page.locator('.rv-step.open')
      await opened.waitFor()
      assert.match(await opened.locator('.rv-step-detail').innerText(), /FINAL\.md|returned without error/)
      assert.ok((await page.evaluate(() => window.selected?.eventId)), 'opening a step selects its event')
      // Every episode opens; every turning point names an episode that exists.
      await page.getByRole('button', { name: 'Open every episode', exact: true }).click()
      const heads = page.locator('.rv-episode-head')
      assert.ok(await heads.count() >= 8)
      assert.equal(await page.locator('.rv-episode-head[aria-expanded="false"]').count(), 0)
      const full = await view.innerText()
      for (const banned of BANNED) assert.equal(full.includes(banned), false, `${theme} ${width}: the opened view prints "${banned}"`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${theme} ${width}: opened episodes keep the page width`)
      if (evidence) await page.screenshot({ path: `${evidence}/record-open-${theme}-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally {
    await browser.close()
    await new Promise(done => server.close(done))
    await rm(scratch, { recursive: true, force: true })
  }
})
