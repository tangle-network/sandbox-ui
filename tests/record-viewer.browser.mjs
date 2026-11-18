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
      assert.match(text, /The run ended at 19:35 UTC with an accepted result\./)
      assert.match(text, /\$25\.89 at list price, not confirmed by a bill/)
      assert.match(text, /138 steps, none failed/)
      assert.match(text, /151,407 output tokens/)
      assert.match(text, /Download the record\s+JSON, \d+ KB/)
      for (const banned of BANNED) assert.equal(text.includes(banned), false, `${theme} ${width}: the view prints "${banned}"`)
      // One line of an excerpt, an output's first line, a lane name and the foot's preview may end in an ellipsis: each
      // opens to its whole text. Nothing else is cut, and no text is under 12 px.
      const ONE_LINE = ['rv-ep-sub', 'rv-step-line', 'rv-lane-label', 'rv-leaves']
      const frame = await page.evaluate((allowed) => {
        const all = [...document.querySelectorAll('.agent-record *')]
        const small = all.filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && parseFloat(getComputedStyle(element).fontSize) < 12 && !element.closest('svg'))
        const clamped = all.filter(element => { const style = getComputedStyle(element); return (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') && !allowed.some(name => element.closest(`.${name}`)) })
        const marks = [...document.querySelectorAll('.rv-marker circle')].map(circle => circle.getBoundingClientRect())
        const overlaps = marks.filter((box, i) => marks.some((other, j) => j !== i && box.left < other.right - 0.5 && other.left < box.right - 0.5 && box.top < other.bottom - 0.5 && other.top < box.bottom - 0.5)).length
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: small.map(element => element.className), clamped: clamped.map(element => element.className), overlaps, height: document.querySelector('.agent-record').getBoundingClientRect().height }
      }, ONE_LINE)
      assert.equal(frame.overflow, 0, `${theme} ${width}: no horizontal scroll`)
      assert.deepEqual(frame.small, [], `${theme} ${width}: no text under 12 px`)
      assert.deepEqual(frame.clamped, [], `${theme} ${width}: only one-line excerpts clamp`)
      assert.equal(frame.overlaps, 0, `${theme} ${width}: turning-point markers never overlap`)
      if (width === 1440) assert.ok(frame.height <= 1800, `the three-hour record's default view is ${Math.round(frame.height)} px tall at 1440`)
      const all = page.getByRole('button', { name: 'Open every episode', exact: true })
      await all.hover()
      assert.equal(await all.evaluate(element => getComputedStyle(element).textDecorationLine), 'none', 'buttons never underline on hover')
      assert.equal(await all.evaluate(element => getComputedStyle(element).transform), 'none', 'nothing zooms on hover')
      if (evidence) await page.screenshot({ path: `${evidence}/record-${theme}-${width}.png`, fullPage: true })
      // Every episode opens; a published step opens to its output and selects its event.
      await all.click()
      const heads = page.locator('.rv-ep-head')
      assert.ok(await heads.count() >= 6)
      assert.equal(await page.locator('.rv-ep-head[aria-expanded="false"]').count(), 0)
      await page.locator('button.rv-step-head').first().click()
      const opened = page.locator('.rv-step.open')
      await opened.waitFor()
      assert.match(await opened.locator('.rv-detail').innerText(), /^(Command|Input|Output)[\s\S]*called \d\d:\d\d:\d\d UTC/)
      assert.ok((await page.evaluate(() => window.selected?.eventId)), 'opening a step selects its event')
      // Opened episodes add the agents' own words, which may use any punctuation; the viewer's words around them stay clean.
      const own = await view.evaluate((root, quoted) => {
        const hidden = [...root.querySelectorAll(quoted)], was = hidden.map(element => element.style.display)
        hidden.forEach(element => { element.style.display = 'none' })
        const text = root.innerText
        hidden.forEach((element, i) => { element.style.display = was[i] })
        return text
      }, '.rv-prose, .rv-footnote, .rv-ep-title, .rv-ep-sub, .rv-step-line.mono, .rv-step-title > span, .rv-step-title > code, pre')
      for (const banned of BANNED) assert.equal(own.includes(banned), false, `${theme} ${width}: the opened view prints "${banned}"`)
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
