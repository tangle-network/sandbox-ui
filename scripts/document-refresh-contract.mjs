import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

/** A held page consumes the packed hook over HTTP while the archive is being rebuilt. */
export async function verifyDocumentRefresh(consumer) {
  const root = await mkdtemp(join(consumer, '.document-refresh-'))
  const requests = []
  let result = 'Previous report', stale = true, hold = false
  let active = 0, peak = 0
  const heldRequest = Promise.withResolvers(), abortedRequest = Promise.withResolvers()
  await writeFile(join(root, 'index.html'), '<main id="root"></main><script type="module" src="/app.jsx"></script>')
  await writeFile(join(root, 'app.jsx'), `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useDocument} from '@tangle-network/sandbox-ui/hooks/use-document';
function Report({id}) {
  const doc = useDocument('/archive/' + id);
  return <output data-stale={String(doc.stale)}>{doc.data?.title ?? 'Loading'}</output>;
}
function App() {
  const [id, open] = useState('study');
  return <><h1>Research archive</h1><button onClick={() => open('other')}>Other report</button>
    <button onClick={() => open(null)}>Close report</button>{id && <Report id={id}/>}</>;
}
createRoot(document.getElementById('root')).render(<App/>);`)
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { host: '127.0.0.1' },
    plugins: [{ name: 'archive', configureServer(vite) {
      vite.middlewares.use('/archive', (req, res) => {
        const etag = `"${result}"`
        const prior = req.headers['if-none-match']
        requests.push({ path: req.url, prior })
        peak = Math.max(peak, ++active)
        res.once('close', () => { active--; if (!res.writableEnded) abortedRequest.resolve() })
        if (hold) { heldRequest.resolve(); return }
        res.setHeader('ETag', etag)
        res.setHeader('Cache-Control', 'no-store')
        if (stale) res.setHeader('X-Workspace-Stale', '1')
        if (prior === etag) { res.writeHead(304); res.end(); return }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ title: result }))
      })
    } }] })
  let browser
  try {
    await server.listen(0)
    browser = await chromium.launch()
    const page = await browser.newPage()
    page.setDefaultTimeout(10_000)
    await page.clock.install()
    await page.goto(server.resolvedUrls.local[0])
    const report = page.locator('output')
    await page.getByText('Previous report', { exact: true }).waitFor()
    // Advance only the browser's clock. Every fetch and ETag response still crosses the HTTP server.
    const revalidate = async (path, status) => {
      const response = page.waitForResponse(reply => new URL(reply.url()).pathname === path, {timeout: 5000})
      await page.clock.fastForward(120_000)
      const next = await response
      assert.equal(next.status(), status)
      if (status === 200) await next.finished()
      await page.evaluate(() => new Promise(resolve => {
        const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve() }; channel.port2.postMessage(null)
      }))
    }
    for (let index = 0; index < 6; index++) await revalidate('/archive/study', 304)
    assert.equal(await report.textContent(), 'Previous report')
    assert.equal(requests.length, 7)
    result = 'Corrected report'; stale = false
    await revalidate('/archive/study', 200)
    await page.getByText('Corrected report', {exact:true}).waitFor()
    assert.equal(await report.getAttribute('data-stale'), 'false')
    await page.clock.fastForward(600_000)
    assert.equal(requests.length, 8, 'a fresh unpolled report stops revalidating')
    assert.deepEqual(requests.map(req=>req.prior), [undefined, ...Array(7).fill('"Previous report"')])

    stale = true
    await page.getByText('Other report', {exact:true}).click()
    await page.locator('output[data-stale="true"]').waitFor()
    assert.equal(requests.at(-1).prior, undefined, 'a different URL has its own validator')
    stale = false
    await revalidate('/archive/other', 304)
    await page.locator('output[data-stale="false"]').waitFor()
    assert.equal(await report.textContent(), 'Corrected report')
    assert.equal(peak, 1)

    hold = true
    await page.reload({waitUntil:'domcontentloaded'})
    await heldRequest.promise
    const duringRequest = requests.length
    await page.clock.fastForward(600_000)
    assert.equal(requests.length, duringRequest, 'the timer cannot create overlapping reads')
    await page.getByText('Close report', {exact:true}).click()
    await abortedRequest.promise
    const atClose = requests.length
    await page.clock.fastForward(600_000)
    assert.equal(requests.length, atClose)
  } finally {
    await browser?.close()
    await server.close()
    await rm(root, {recursive:true,force:true})
  }
}
