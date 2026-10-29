/** Public packed hooks over native HTTP/SSE: reconnection, generation changes, terminal end and URL cleanup. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { build } from 'vite'
import { chromium } from 'playwright'

const consumer=process.env.RUNTIME_VIEWER_CONSUMER
assert.ok(consumer,'Use a fresh installed package consumer')
const require=createRequire(resolve(consumer,'package.json'))
const evidence=process.env.EVENT_STREAM_EVIDENCE
const row=(seq,kind,extra={})=>({seq,at:new Date(Date.UTC(2026,9,29,0,0,seq)).toISOString(),event:{kind,...extra}})
const event=(name,data)=>`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`

async function hostBundle(scratch){
  const entry=resolve(scratch,'host.js')
  await writeFile(entry,`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{useAgentStream,useEventStream}from'@tangle-network/sandbox-ui/run';
function Host(){const[url,set]=useState('/agent');const state=useAgentStream(url);const[frame,put]=useState('');useEventStream('/workspace',{events:{workspace:event=>put(event.data)}});return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>set('/other')},'Change agent'),React.createElement('output',{'data-state':''},JSON.stringify(state)),React.createElement('output',{'data-workspace':''},frame))}createRoot(document.getElementById('host')).render(React.createElement(Host));`)
  const built=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,lib:{entry,formats:['es'],fileName:()=> 'host.js'},rollupOptions:{output:{chunkFileNames:'host/[name]-[hash].js'}}}})
  return new Map((Array.isArray(built)?built:[built]).flatMap(result=>result.output).map(item=>[item.fileName,item.type==='chunk'?item.code:item.source]))
}

function protocol(chunks){
  const requests=[],clients=new Set();let first,workspace=0,agent=0
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost')
    if(url.pathname.startsWith('/assets/')){res.setHeader('content-type','text/javascript');return res.end(chunks.get(url.pathname.slice(8)))}
    if(url.pathname==='/')return res.end('<!doctype html><meta charset="utf-8"><div id="host"></div><script type="module" src="/assets/host.js"></script>')
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.flushHeaders();clients.add(res);res.on('close',()=>clients.delete(res))
    if(url.pathname==='/workspace'){workspace++;res.write(event('workspace',{sequence:workspace}));if(workspace===1)res.end();else res.end(event('end',{}));return}
    requests.push({path:url.pathname,after:url.searchParams.get('after')})
    if(url.pathname==='/other')return res.end(event('reset',{generation:'other'})+event('rows',{generation:'other',events:[row(1,'text',{text:'Other agent only'})]})+event('end',{}))
    agent++
    if(agent===1){res.write(event('rows',{generation:'old',events:[row(7,'text',{text:'Old generation answer'})]}));first=res;return}
    if(agent===2)return res.end(event('rows',{generation:0,events:[row(1,'text',{text:'New generation answer'})]}))
    return res.end(event('rows',{generation:0,events:[row(1,'text',{text:'New generation answer'}),row(2,'tool-call',{toolCallId:'read-1',toolName:'read',args:{path:'retained.txt'}}),row(3,'tool-result',{toolCallId:'read-1',result:'Retained bytes'})]})+event('end',{}))
  })
  return {server,requests,continue:()=>first.end(),workspace:()=>workspace,close:()=>{for(const response of clients)response.end()}}
}

for(const theme of ['light','dark'])for(const width of [1512,390])test(`packed streams preserve authority and cursor ${theme} ${width}`,{timeout:60_000},async()=>{
  const scratch=await mkdtemp(resolve(consumer,'.stream-host-')),chunks=await hostBundle(scratch),wire=protocol(chunks)
  await new Promise(resolve=>wire.server.listen(0,'127.0.0.1',resolve));if(evidence)await mkdir(evidence,{recursive:true})
  const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,...(evidence?{recordVideo:{dir:evidence,size:{width,height:844}}}:{})})
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto(`http://127.0.0.1:${wire.server.address().port}/`)
    await page.waitForFunction(()=>document.querySelector('[data-state]')?.textContent.includes('Old generation answer'))
    wire.continue()
    await page.waitForFunction(()=>{const state=JSON.parse(document.querySelector('[data-state]').textContent);return state.generation===0&&state.lastSeq===3&&!state.alive})
    const state=JSON.parse(await page.locator('[data-state]').textContent())
    assert.equal(state.entries.filter(item=>item.kind==='message').length,1);assert.equal(state.entries[0].content,'New generation answer')
    assert.equal(state.entries[1].call.output,'Retained bytes');assert.equal(state.entries[1].call.status,'success');assert.equal(state.entries[1].call.duration,1000)
    assert.deepEqual(wire.requests,[{path:'/agent',after:null},{path:'/agent',after:'7'},{path:'/agent',after:'1'}])
    await page.waitForFunction(()=>document.querySelector('[data-workspace]')?.textContent.includes('2'));assert.equal(wire.workspace(),2)
    await page.waitForTimeout(1250);assert.equal(wire.requests.length,3,'terminal end must not reconnect')
    await page.getByRole('button',{name:'Change agent',exact:true}).click()
    await page.waitForFunction(()=>{const state=JSON.parse(document.querySelector('[data-state]').textContent);return state.generation==='other'&&!state.alive})
    const other=JSON.parse(await page.locator('[data-state]').textContent());assert.equal(other.entries.length,1);assert.equal(other.entries[0].content,'Other agent only')
    assert.deepEqual(wire.requests.at(-1),{path:'/other',after:null});assert.deepEqual(errors,[])
    if(evidence){await page.screenshot({path:`${evidence}/stream-${theme}-${width}.png`});await writeFile(`${evidence}/stream-${theme}-${width}.json`,JSON.stringify({state,other,requests:wire.requests,workspaceReconnects:wire.workspace()},null,2))}
  }finally{await context.close();await browser.close();wire.close();await new Promise(resolve=>wire.server.close(resolve));await rm(scratch,{recursive:true,force:true})}
})
