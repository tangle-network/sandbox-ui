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
await writeFile(join(consumer, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#grow-first{position:fixed;right:0;top:0;z-index:10}#pane{height:900px;overflow:auto}#vault-case{padding:16px}#vault-controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}#vault-pane{height:360px;overflow:auto}#vault-case [role=treeitem]{height:40px;min-height:40px;box-sizing:border-box}#vault-case[data-scope=A] [data-path=docs]{height:240px;min-height:240px}</style></head><body><div id="app"></div><script type="module" src="/strict.jsx"></script></body></html>')
await writeFile(join(consumer, 'strict.jsx'), `
import React,{StrictMode,useRef,useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {VirtualList} from '@tangle-network/sandbox-ui/run/record'
import {VaultTree,fileTreeFromPaths} from '@tangle-network/sandbox-ui/vault-tree'
import '@tangle-network/sandbox-ui/styles'
const items=Array.from({length:200},(_,i)=>i),keyOf=i=>String(i)
const render=i=><div style={{height:i===0?'var(--first-height,40px)':40}}>Row {i}</div>
const folderCount=221,lastGuide='docs/folder-220/guide.md'
function App(){
 const pane=useRef(null),[scope,setScope]=useState('A'),[selected,setSelected]=useState(lastGuide),[revision,setRevision]=useState(0),[flat,setFlat]=useState(false),[count,setCount]=useState(98)
 useEffect(()=>{document.documentElement.dataset.setups=String(Number(document.documentElement.dataset.setups||0)+1);return()=>{document.documentElement.dataset.cleanups=String(Number(document.documentElement.dataset.cleanups||0)+1)}},[])
 const paths=flat?['docs/guide.md',...Array.from({length:count-1},(_,i)=>'docs/row-'+String(i).padStart(3,'0')+'.md')]:Array.from({length:folderCount},(_,i)=>'docs/folder-'+String(i).padStart(3,'0')+'/guide.md')
 const root={name:'Documents',path:'',type:'directory',children:fileTreeFromPaths(paths)}
 return <><button id="grow-first" onClick={()=>document.documentElement.style.setProperty('--first-height','240px')}>Grow first row</button>
  <div id="pane" role="region" aria-label="Measured records" tabIndex={0} ref={pane}><VirtualList items={items} keyOf={keyOf} render={render} scroller={pane} estimate={40}/></div>
  <section id="vault-case" data-scope={scope}><h2>Scoped documents</h2><div id="vault-controls">
   <button onClick={()=>setScope('A')}>Use workspace A</button><button onClick={()=>setScope('B')}>Use workspace B</button>
   <button onClick={()=>setRevision(n=>n+1)}>Refresh workspace</button><button onClick={()=>setSelected(undefined)}>Clear selection</button>
   <button onClick={()=>setSelected(lastGuide)}>Select long file</button>
   <button onClick={()=>{setFlat(true);setCount(98);setSelected('docs/guide.md')}}>Show 98 files</button><button onMouseDown={event=>event.preventDefault()} onClick={()=>setCount(n=>n+3)}>Append three files</button>
  </div><output aria-label="Active workspace">{scope}</output><output aria-label="Workspace revision">{revision}</output><output aria-label="Selected scoped file">{selected??'None'}</output>
  <div id="vault-pane" role="region" aria-label="Scoped files"><VaultTree root={root} selectedPath={selected} onSelect={setSelected} storageKey={'scope-'+scope} label="Scoped documents"/></div></section>
  <div aria-hidden style={{height:160}}/>
 </>
}
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
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))
async function scopedVault(page, width) {
  const pane = page.getByRole('region', { name: 'Scoped files', exact: true })
  const tree = page.getByRole('tree', { name: 'Scoped documents', exact: true })
  const row = path => tree.locator(`[data-path="${path}"]`)
  const selected = 'docs/folder-220/guide.md', logicalRows = 221 + 2
  const settled = async () => {
    await row(selected).waitFor({ state: 'visible' })
    await page.waitForFunction(path => {
      const row = document.querySelector(`[data-path="${path}"]`), pane = document.querySelector('#vault-pane')
      if (!row || !pane) return false
      const r = row.getBoundingClientRect(), p = pane.getBoundingClientRect()
      return r.top >= Math.max(0, p.top) - 1 && r.bottom <= Math.min(innerHeight, p.bottom) + 1
    }, selected)
  }
  const warm = async () => {
    await row(selected).focus(); await page.keyboard.press('Home')
    await row('docs').waitFor({ state: 'visible' })
    await pane.hover()
    let reachedEnd = false
    for (let step = 0; step < 32; step++) {
      await page.mouse.wheel(0, 520); await frames(page)
      const bounds = await pane.evaluate(node => ({ top: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight }))
      if (bounds.top + bounds.viewport >= bounds.height - 1) { reachedEnd = true; break }
    }
    assert.equal(reachedEnd, true, 'Native scrolling reaches every measured row within its bounded walk')
    await frames(page)
    return pane.evaluate(node => node.scrollHeight)
  }
  await pane.hover(); await settled()
  const mounted = await tree.elementHandle()
  assert.equal(await row('docs/folder-220').getAttribute('aria-posinset'), '221', 'The selected guide is beyond the first 200-child page')
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tangle:vault-tree:scope-A')).sort()), ['docs', 'docs/folder-220'], 'Only docs and the selected guide’s parent open')
  assert.ok(await tree.getByRole('treeitem').count() < 100)
  await row(selected).focus(); await page.keyboard.press('Home'); await row('docs').click()
  assert.equal(await row('docs').getAttribute('aria-expanded'), 'false')
  const revision = await page.getByLabel('Workspace revision', { exact: true }).textContent()
  await page.getByRole('button', { name: 'Refresh workspace', exact: true }).click()
  await page.waitForFunction(before => document.querySelector('[aria-label="Workspace revision"]').textContent !== before, revision)
  await frames(page)
  assert.equal(await row('docs').getAttribute('aria-expanded'), 'false', 'A rebuilt same-scope index respects the reader’s manual collapse')
  assert.equal(await row(selected).count(), 0)
  await row('docs').click(); await row('docs').focus(); await page.keyboard.press('End'); await settled()
  assert.equal(await page.evaluate(() => localStorage.getItem('tangle:vault-tree:scope-B')), null, 'Workspace B starts with its own collapsed expansion')
  await page.getByRole('button', { name: 'Use workspace B', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Active workspace"]').textContent === 'B')
  await settled()
  assert.equal(await mounted.evaluate(node => node.isConnected && node === document.querySelector('[role="tree"][aria-label="Scoped documents"]')), true, 'Switching storage keys preserves the mounted public VaultTree')
  assert.equal(await row('docs/folder-220').getAttribute('aria-posinset'), '221')
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tangle:vault-tree:scope-B')).sort()), ['docs', 'docs/folder-220'])
  assert.ok(await tree.getByRole('treeitem').count() < 100)
  await page.screenshot({ path: join(output, 'strict18-scope-reveal-' + width + '.png'), fullPage: true })

  await page.getByRole('button', { name: 'Use workspace A', exact: true }).click(); await settled()
  const aHeight = await warm()
  assert.equal(aHeight, 240 + (logicalRows - 1) * 40, 'A retains its own measured 240px first row after a complete native walk')
  await row(selected).focus(); await frames(page)
  await page.waitForFunction(() => !document.querySelector('#vault-pane [data-path="docs"]'))
  await page.getByRole('button', { name: 'Use workspace B', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Active workspace"]').textContent === 'B')
  await settled(); await frames(page)
  const bColdHeight = await pane.evaluate(node => node.scrollHeight)
  assert.ok(bColdHeight <= logicalRows * 40, 'B discards A’s 240px offscreen measurement; cold 33px estimates may be below the final height')
  assert.ok(bColdHeight < aHeight)
  const bHeight = await warm()
  assert.equal(bHeight, logicalRows * 40, 'B reaches its own complete 40px-per-row geometry after native measurement')
  await row('docs').focus(); await page.keyboard.press('Home')
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
  await page.getByRole('button', { name: 'Select long file', exact: true }).click(); await settled()
  assert.ok(await tree.getByRole('treeitem').count() < 100, 'The offscreen selected guide settles without expanding the DOM or scrolling the target by hand')

  await page.getByRole('button', { name: 'Show 98 files', exact: true }).click()
  await row('docs/guide.md').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('[data-path="docs/guide.md"]')?.getAttribute('aria-setsize') === '98')
  assert.equal(await tree.getByRole('treeitem').count(), 99)
  const first = await tree.getByRole('treeitem').first().elementHandle()
  await first.focus()
  // This toolbar action preserves focus on mousedown; a lost tree row cannot be hidden by re-focusing it afterward.
  await page.getByRole('button', { name: 'Append three files', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[data-path="docs/guide.md"]')?.getAttribute('aria-setsize') === '101')
  assert.equal(await first.evaluate(node => node.isConnected && node === document.activeElement && node === document.querySelector('#vault-pane [role="treeitem"]')), true, 'Same-scope 99→102 rows retain the identical focused DOM row')
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-path') === 'docs/guide.md')
  assert.ok(await tree.getByRole('treeitem').count() < 100)
  await page.screenshot({ path: join(output, 'strict18-scope-bounded-' + width + '.png'), fullPage: true })
  await first.dispose(); await mounted.dispose()
  return { visibleRows: logicalRows, selected, aHeight, bColdHeight, bHeight, sameScopeCollapse: true, focusedThreshold: [99, 102] }
}
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
      const scope = await scopedVault(page, width)
      assert.deepEqual(errors, [])
      checks.push({ width, react: '18.3.1', strictMode: true, ...measured, scope, result: 'PASS' })
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
console.log('Packed React18 StrictMode: measured heights, mounted workspace reveal and bounded focus in both widths PASS')
