import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [consumer, output] = process.argv.slice(2)
assert.ok(consumer && output)
const host = createRequire(resolve('package.json'))
const installed = createRequire(resolve(consumer, 'package.json'))
assert.equal(installed('react/package.json').version, '18.3.1')
const { build } = await import(pathToFileURL(host.resolve('vite')))
const { chromium } = host('playwright')
await mkdir(output, { recursive: true })
await writeFile(join(consumer, 'index.html'), '<!doctype html><html><head><style>body{margin:0}button{position:fixed;right:0;top:0}#pane{height:900px;overflow:auto}</style></head><body><div id="app"></div><script type="module" src="/strict.jsx"></script></body></html>')
await writeFile(join(consumer, 'strict.jsx'), `
import React,{StrictMode,useRef,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {VirtualList} from '@tangle-network/sandbox-ui/run/record'
const items=Array.from({length:200},(_,i)=>i),keyOf=i=>String(i)
const render=i=><div style={{height:i===0?'var(--first-height,40px)':40}}>Row {i}</div>
function App(){const pane=useRef(null);useEffect(()=>{document.documentElement.dataset.setups=String(Number(document.documentElement.dataset.setups||0)+1);return()=>{document.documentElement.dataset.cleanups=String(Number(document.documentElement.dataset.cleanups||0)+1)}},[]);return <><button onClick={()=>document.documentElement.style.setProperty('--first-height','240px')}>Grow first row</button><div id="pane" role="region" aria-label="Measured records" tabIndex={0} ref={pane}><VirtualList items={items} keyOf={keyOf} render={render} scroller={pane} estimate={40}/></div></>}
createRoot(document.getElementById('app')).render(<StrictMode><App/></StrictMode>)
`)
await build({ configFile: false, root: consumer, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('development') }, build: { outDir: 'strict-dist', emptyOutDir: true } })
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const file = resolve(consumer, 'strict-dist', '.' + (pathname === '/' ? '/index.html' : pathname))
    assert.ok(file.startsWith(resolve(consumer, 'strict-dist') + '/'))
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(await readFile(file))
  } catch { res.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true }), checks = []
try {
  for (const width of [1512, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 982 }, recordVideo: { dir: output, size: { width, height: 982 } } })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto('http://127.0.0.1:' + server.address().port)
      const pane = page.getByRole('region', { name: 'Measured records' })
      await page.getByText('Row 0', { exact: true }).waitFor()
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.setups, document.documentElement.dataset.cleanups]), ['2', '1'], 'React18 actually performed the development StrictMode setup/cleanup replay')
      assert.equal(await pane.evaluate(el => el.scrollHeight), 8000)
      await page.getByRole('button', { name: 'Grow first row' }).click()
      await page.waitForFunction(() => document.querySelector('.virtual-row').getBoundingClientRect().height === 240)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))
      assert.equal(await pane.evaluate(el => el.scrollTop), 0, 'Height arrives without scrolling or a parent React render')
      await pane.focus()
      await page.keyboard.press('End')
      await page.getByText('Row 199', { exact: true }).waitFor()
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('.virtual-row')).some(el => el.textContent === 'Row 0'))
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const measured = await pane.evaluate(el => ({ height: el.scrollHeight, top: el.scrollTop, mounted: el.querySelectorAll('.virtual-row').length }))
      assert.equal(measured.height, 8200, 'Measured 240px row remains in offsets after it unmounts; disconnected StrictMode observer loses this height')
      assert.equal(measured.top, 7300)
      assert.ok(measured.mounted < 65)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: join(output, 'strict18-end-' + width + '.png'), fullPage: true })
      checks.push({ width, react: '18.3.1', strictMode: true, ...measured, result: 'PASS' })
    } catch (error) {
      await page.screenshot({ path: join(output, 'failure-' + width + '.png'), fullPage: true })
      await writeFile(join(output, 'failure-' + width + '.json'), JSON.stringify({ error: String(error), errors, text: await page.locator('body').innerText() }, null, 2))
      throw error
    } finally { await context.close() }
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
  await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2))
}
console.log('Packed React18 StrictMode: measured height survives offscreen unmount in both widths PASS')
