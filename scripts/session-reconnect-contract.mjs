import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

/** Exercise the installed public hook against a real, controllable event stream. */
export async function verifySessionReconnect(consumerDir) {
  const root = await mkdtemp(join(consumerDir, '.session-reconnect-'))
  await writeFile(join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.jsx"></script>')
  await writeFile(join(root, 'main.jsx'), `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSessionStream } from '@tangle-network/sandbox-ui/hooks';
function App() {
  const [sessionId, select] = useState('first');
  const { connected, reconnecting, error, errorCode, isStreaming } = useSessionStream({ apiUrl: location.origin, token: 'example', sessionId });
  const state = { sessionId, connected, reconnecting, errorCode, error, isStreaming };
  return <><button onClick={() => select('second')}>Switch chat</button><output>{JSON.stringify(state)}</output></>;
}
createRoot(document.getElementById('root')).render(<App/>);`)
  let peer
  let accept = true
  let resolveSecond
  const requestedSecond = new Promise(resolve => { resolveSecond = resolve })
  const server = await createServer({ configFile: false, root, logLevel: 'error', plugins: [{ name: 'session-peer', configureServer(vite) {
    vite.middlewares.use('/agents', (req, res) => {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== '/events') {
        res.setHeader('content-type', 'application/json')
        return res.end(url.pathname.endsWith('/messages') ? '[]' : '{}')
      }
      const attach = () => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write(': connected\n\n')
        peer = res
      }
      if (url.searchParams.get('sessionId') === 'second') { resolveSecond(attach); return }
      if (accept) attach()
      else { res.writeHead(503); res.end() }
    })
  } }] })
  const browser = await chromium.launch()
  try {
    await server.listen(0)
    const page = await browser.newPage()
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' })
    const wait = expected => page.waitForFunction(fields => {
      const text = document.querySelector('output')?.textContent
      if (!text) return false
      const state = JSON.parse(text)
      return Object.entries(fields).every(([key, value]) => state[key] === value)
    }, expected, { timeout: 12_000 })
    await wait({ connected: true, reconnecting: false })
    accept = false
    peer.end()
    await wait({ connected: false, reconnecting: true, errorCode: 'SESSION_STREAM_CLOSED' })
    await wait({ connected: false, reconnecting: true, errorCode: 'HTTP_503' })
    accept = true
    await wait({ connected: true, reconnecting: false, error: null, errorCode: null })
    peer.end()
    await wait({ reconnecting: true })
    const changing = page.waitForRequest(request => request.url().includes('sessionId=second'), { timeout: 10_000 })
    await page.getByRole('button', { name: 'Switch chat' }).click()
    await changing
    await wait({ sessionId: 'second', connected: false, reconnecting: false, error: null, errorCode: null, isStreaming: false })
    const attachSecond = await requestedSecond
    attachSecond()
    await wait({ connected: true, reconnecting: false, errorCode: null })
  } finally {
    peer?.end()
    await browser.close()
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
}
