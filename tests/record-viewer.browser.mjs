import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import { build } from 'vite'
import { chromium } from 'playwright'

// A retained Discovery projection with real per-response counters, metered windows and tool returns.
test('record usage keeps original source actions and measured semantics through the shared figure', { timeout: 150_000 }, async () => {
  const manifest = process.env.SANDBOX_UI_PACKAGE ?? resolve('package.json')
  const require = createRequire(manifest)
  const styles = require.resolve('@tangle-network/sandbox-ui/styles')
  const bytes = await readFile(new URL('./fixtures/waterfall-discovery-record.json', import.meta.url))
  const digest = createHash('sha256').update(bytes).digest('hex'), record = JSON.parse(bytes)
  assert.equal(record.events.length, 281)
  assert.ok(record.events.some(event => event.detail?.usageScope), 'the retained projection includes aggregate windows')
  const firstUsage = record.events.find(event => event.node === 'root' && event.detail?.usage && event.detail.usageScope === undefined)
  assert.ok(firstUsage)
  const response=await fetch('https://raw.githubusercontent.com/drewstone/drewstone.github.io/95e0aaf65b6c36fc51717869d92637fd4f5c4b88/public/research/records/ftqc-zips-2026-08-05-r1.json')
  assert.equal(response.ok,true,'immutable retained publication remains readable')
  const stoppedBytes=Buffer.from(await response.arrayBuffer()), stoppedRecord=JSON.parse(stoppedBytes)
  assert.equal(createHash('sha256').update(stoppedBytes).digest('hex'),'eaca6f51114ccea5c3213d39b83ae69f4b61f14d8ea4d1c4df0408152227b700')
  const stoppedActors=stoppedRecord.nodes.filter(node=>node.status==='down')
  assert.equal(stoppedActors.length,2,'the immutable real publication retains two stopped actors')
  // Adversarial public inputs derived from the unchanged retained fixture; never research outputs.
  const boundary = (name, events) => ({ ...record, title: 'Boundary input: '+name, events, claims: [], verdicts: [], publications: [] })
  const unknown = structuredClone(firstUsage); delete unknown.detail.usage; delete unknown.detail.usageScope
  const zero = structuredClone(firstUsage); zero.detail.usage = { input:0, output:0, cacheRead:0, cacheWrite:0 }
  const partial = structuredClone(firstUsage); partial.detail.usage = { input:7, output:3 }
  const scoped = record.events.find(event => event.detail.usageScope !== undefined); assert.ok(scoped)
  const calls = record.events.filter(event => event.node === 'root' && event.detail.publicToolCalls?.length === 1).slice(0,3).map(event => structuredClone(event))
  assert.equal(calls.length,3)
  const results = calls.map(call => structuredClone(record.events.find(event => event.node === call.node && event.detail.toolCallId === call.detail.publicToolCalls[0].id)))
  assert.ok(results.every(Boolean))
  const uniqueCall=calls[2], uniqueResult=results[2]
  const invertedCall=structuredClone(uniqueCall), invertedResult=structuredClone(uniqueResult);invertedCall.at=uniqueResult.at;invertedResult.at=uniqueCall.at
  for(let i=0;i<2;i++){calls[i].detail.publicToolCalls[0].id='repeated-call';calls[i].detail.toolCallIds=['repeated-call'];results[i].detail.toolCallId='repeated-call'}
  const cases = new Map([['inverted',boundary('inverted recorded timestamps',[invertedCall,invertedResult])],['unknown',boundary('unmeasured',[unknown])],['zero',boundary('recorded zero',[zero])],['partial',boundary('incomplete counters',[partial])],['scoped',boundary('scoped-only retained window',[scoped])],['ambiguous',boundary('repeated identity and out-of-order rows',[results[1],calls[1],uniqueCall,calls[0],results[0],uniqueResult])]])
  const evidence = process.env.RUN_UI_EVIDENCE_DIR, checks = []
  if (evidence) await mkdir(evidence, { recursive: true })
  const scratch = await mkdtemp(resolve(dirname(manifest), '.usage-host-')), entry = resolve(scratch, 'host.js')
  await writeFile(entry, `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{AgentRecord,RecordWorkGraph}from'@tangle-network/sandbox-ui/record';import{parseRecord}from'@drewstone/agent-record/record';
import{fromResearchPublication}from'@drewstone/agent-record/adapters/research-publication';import{recordModel}from'@tangle-network/sandbox-ui/run/record';const raw=await fetch('/retained-record'+location.search).then(response=>response.json());const record=raw.schema==='research-publication.events.v1'?fromResearchPublication(raw):parseRecord(raw);window.recordedProjection=recordModel.recordFlowTrace(record);const initial={runId:record.runId,nodeId:record.nodes.find(node=>node.kind==='agent')?.id??'root',view:'usage'};
function Host(){const[selection,set]=useState(initial);const[graph,showGraph]=useState(false);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>{window.chosen=initial;set(initial)}},'Return to full usage'),React.createElement('button',{onClick:()=>showGraph(true)},'Read retained relationships'),graph?React.createElement(RecordWorkGraph,{record}):React.createElement(AgentRecord,{records:[record],selection,onSelectionChange:value=>{window.chosen=value;set(value)},theme:new URL(location.href).searchParams.get('theme')}))}createRoot(document.getElementById('host')).render(React.createElement(Host));`)
  const built = await build({ root:dirname(manifest), configFile:false, logLevel:'silent', resolve:{dedupe:['react','react-dom']}, define:{'process.env.NODE_ENV':JSON.stringify('production')}, build:{write:false,lib:{entry,formats:['es'],fileName:()=> 'host.js'},rollupOptions:{output:{chunkFileNames:'usage/[name]-[hash].js'}}} })
  const chunks = new Map((Array.isArray(built)?built:[built]).flatMap(result=>result.output).map(item=>[item.fileName,item.type==='chunk'?item.code:item.source]))
  let theme='light'
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname
    if(path==='/retained-record'){res.setHeader('content-type','application/json');const params=new URL(req.url,'http://localhost').searchParams;const selected=cases.get(params.get('boundary'));return res.end(selected?JSON.stringify(selected):params.has('stopped')?stoppedBytes:bytes)}
    if(path==='/styles.css'){res.setHeader('content-type','text/css');return res.end(await readFile(styles))}
    const chunk=chunks.get(path.slice(1));if(chunk!==undefined){res.setHeader('content-type',path.endsWith('.css')?'text/css':'text/javascript');return res.end(chunk)}
    res.setHeader('content-type','text/html');res.end(`<!doctype html><html class="${theme}" data-theme="${theme}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="host"></div><script type="module" src="/host.js"></script></html>`)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({headless:true})
  try{
    for(theme of ['light','dark'])for(const width of [1512,390]){
      const context=await browser.newContext({viewport:{width,height:982},colorScheme:theme,...(evidence?{recordVideo:{dir:evidence,size:{width,height:982}}}:{})})
      const page=await context.newPage(), errors=[], began=Date.now(), captions={}
      page.on('pageerror',error=>{errors.push(error.message);console.error('usage host:',error.message)})
      await page.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`)
      await page.getByRole('button',{name:'Return to full usage',exact:true}).waitFor({timeout:10_000}).catch(async error=>{if(evidence)await page.screenshot({path:`${evidence}/host-failure-${theme}-${width}.png`,fullPage:true});throw new Error(JSON.stringify({errors}),{cause:error})})
      const reset=async()=>{await page.getByRole('button',{name:'Return to full usage',exact:true}).click();await page.getByRole('tab',{name:'Usage',exact:true}).waitFor()}
      const tree=page.locator('[data-graph]')
      await page.locator('.topology > summary').click()
      await tree.waitFor()
      assert.equal(await tree.locator('[data-node]').count(),2,'each canonical actor appears once')
      const cursor=page.getByRole('slider',{name:'Playback position',exact:true});await cursor.focus();await page.keyboard.press('Home')
      await page.waitForFunction(()=>document.querySelector('[aria-label="Playback position"]')?.value==='0')
      const child=tree.locator('[data-node="echo"]')
      assert.match(await child.getAttribute('aria-label'),/Not yet started/)
      assert.equal(await child.locator('[data-run-status]').getAttribute('data-run-status'),'unknown','a future actor stays unknown')
      await child.focus();await page.keyboard.press('Enter')
      assert.equal(await page.locator('[data-agent]').inputValue(),'echo','keyboard selection keeps canonical agent identity')
      await page.getByRole('button',{name:'Show full trace',exact:true}).click()
      await tree.locator('[data-node="root"]').click()
      assert.equal(await page.locator('[data-agent]').inputValue(),'root')
      assert.equal(await tree.locator('[data-node="root"] [data-run-status]').getAttribute('data-run-status'),'stopped','known no-winner is terminal, not unknown')
      if(evidence)await page.screenshot({path:evidence+'/tree-'+theme+'-'+width+'.png',fullPage:true})
      for(const metric of ['cumulative','response','tool-time'])for(const axis of ['time','order']){
        await reset()
        await page.getByRole('combobox',{name:'Measure',exact:true}).selectOption(metric)
        await page.getByRole('combobox',{name:'Horizontal axis',exact:true}).selectOption(axis)
        const caption=page.locator('[data-token-caption]');await caption.waitFor()
        captions[metric+'/'+axis]=await caption.innerText()
        assert.match(captions[metric+'/'+axis],metric==='tool-time'?/Observed tool return time, not model latency/:/tokens are not billed cost/)
        if(metric==='response')assert.equal(await page.getByText('metered windows · execution-to-date',{exact:true}).count(),0,'aggregate counters are not per-response measurements')
      }
      await reset();await page.getByRole('combobox',{name:'Measure',exact:true}).selectOption('cumulative')
      await page.getByTitle('Hide Input',{exact:true}).click()
      await page.getByTitle('Show Input',{exact:true}).click()
      assert.equal(await page.getByTitle('Hide Input',{exact:true}).getAttribute('aria-pressed'),'true')
      if(await page.locator('[data-tokens] .tgc-data').count()){
        const rows=await page.locator('[data-tokens] .tgc-data tbody tr').evaluateAll(nodes=>nodes.map(node=>[...node.children].map(cell=>cell.textContent.trim())))
        assert.ok(rows.some(row=>row[0]==='Cache read'&&/^0(?: tokens)?$/.test(row[2])),'a recorded zero remains a measured zero')
        if(record.events.some(event=>event.node==='root'&&event.detail?.usage&&Object.values(event.detail.usage).length<4))assert.ok(rows.some(row=>row[2]==='not measured'),'an absent counter remains unmeasured')
        for(const label of ['Input','Output','Cache read','Cache write'])await page.getByTitle(`Hide ${label}`,{exact:true}).click()
        await page.getByText('All token channels are hidden. Select a channel to show its recorded values.',{exact:true}).waitFor()
        for(const label of ['Input','Output','Cache read','Cache write'])await page.getByTitle(`Show ${label}`,{exact:true}).click()
      }
      const sourceActions=[]
      for(const action of ['click','Enter','Space']){
        await reset()
        const point=page.locator('[data-tokens] .tgc-series-observation:visible,[data-tokens] circle[data-id]:visible').first()
        await point.waitFor();assert.equal(await point.getAttribute('role'),'button','an activated point exposes its action to assistive technology')
        if(action==='click'){await point.scrollIntoViewIfNeeded();const box=await point.boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2)}else{await point.focus();await page.keyboard.press(action)}
        await page.waitForFunction(()=>window.chosen?.view==='source')
        const chosen=await page.evaluate(()=>window.chosen)
        assert.equal(chosen.eventId,firstUsage.id,'each activation opens the original retained event, including duplicate-time/zero-valued channels')
        assert.equal(await page.getByRole('tab',{name:'Event details',exact:true}).getAttribute('aria-selected'),'true')
        sourceActions.push({action,eventId:chosen.eventId})
      }
      await reset();await page.getByRole('combobox',{name:'Measure',exact:true}).selectOption('cumulative')
      await page.locator('[data-tokens]').scrollIntoViewIfNeeded()
      if(evidence)await page.screenshot({path:`${evidence}/usage-${theme}-${width}.png`,fullPage:true})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      for(const name of ['unknown','scoped','zero','partial','ambiguous','inverted']){
        await page.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}&boundary=${name}`)
        await page.locator('.fw-summary').waitFor()
        const projected=await page.evaluate(()=>window.recordedProjection)
        const tokens=page.locator('.fw-summary > div').filter({has:page.locator('dt').filter({hasText:/^Tokens$/})}).locator('dd')
        if(name==='zero'){assert.equal(projected.promptTokens,0);assert.equal(projected.completionTokens,0);assert.equal(await tokens.innerText(),'0')}
        else{assert.equal(await tokens.innerText(),'—');assert.equal(await tokens.getAttribute('title'),'Tokens not reported')}
        if(name==='partial'){
          assert.equal(projected.promptTokens,undefined);assert.equal(projected.completionTokens,3)
          assert.match(projected.spans.find(span=>span.meta?.eventId===partial.id).facts.find(fact=>fact.label==='Tokens').value,/≥ 10 measured; incomplete counters/)
          assert.match(await page.locator('[data-token-caption]').innerText(),/Some responses lack counters/)
        }
        if(name==='inverted'){
          for(const id of [uniqueCall.id,uniqueResult.id]){const span=projected.spans.find(span=>span.meta?.eventId===id);assert.ok(span,id+' source retained');assert.equal(span.startMs,span.endMs);assert.equal(span.approx,true);assert.equal(span.status,'unknown');assert.match(span.facts.find(fact=>fact.label==='Timing').value,/result timestamp precedes call/)}
        }
        if(name==='ambiguous'){
          const ambiguousIds=[calls[0].id,calls[1].id,results[0].id,results[1].id]
          for(const id of ambiguousIds){const span=projected.spans.find(span=>span.meta?.eventId===id);assert.ok(span,id+' source retained');assert.equal(span.startMs,span.endMs);assert.equal(span.approx,true);assert.equal(span.status,'unknown');assert.match(span.facts.find(fact=>fact.label==='Timing').value,/ambiguous/i)}
          const joined=projected.spans.find(span=>span.meta?.eventId===uniqueCall.id)
          assert.equal(joined.endMs-joined.startMs,Date.parse(uniqueResult.at)-Date.parse(uniqueCall.at));assert.equal(joined.approx,false);assert.equal(joined.status,'done');assert.equal(projected.toolCalls,3)
          await page.getByRole('combobox',{name:'Measure',exact:true}).selectOption('tool-time')
          assert.match(await page.locator('[data-token-caption]').innerText(),/ambiguous and out-of-order results are omitted/)
          const point=page.locator('[data-tokens] .tgc-series-observation:visible,[data-tokens] circle[data-id]:visible').first();await point.focus();await page.keyboard.press('Enter')
          await page.waitForFunction(()=>window.chosen?.view==='source');assert.equal((await page.evaluate(()=>window.chosen)).eventId,uniqueResult.id)
        }
      }
      await page.goto('http://127.0.0.1:'+server.address().port+'/?theme='+theme+'&stopped')
      const stoppedCursor=page.getByRole('slider',{name:'Playback position',exact:true});await stoppedCursor.focus();await page.keyboard.press('Home')
      await page.getByRole('button',{name:'Show full trace',exact:true}).click()
      await page.locator('.topology > summary').click()
      for(const node of stoppedActors){
        const button=page.locator('[data-graph] [data-node='+JSON.stringify(node.id)+']')
        assert.equal(await button.count(),1,'each stopped publication actor is retained once')
        assert.match(await button.getAttribute('aria-label'),/Stopped/)
        assert.equal(await button.locator('[data-run-status]').getAttribute('data-run-status'),'stopped')
        await button.focus();await page.keyboard.press('Enter')
        assert.equal(await page.locator('[data-agent]').inputValue(),node.id,'stopped actor selection preserves original identity')
      }
      for(const node of stoppedRecord.nodes.filter(node=>node.kind==='runtime')){
        const expected=node.status==='down'?'Stopped':node.status==='done'?'Done':'Unknown'
        const row=page.locator('[data-flow-waterfall] [data-span-id='+JSON.stringify(node.id)+']')
        await row.locator('.fw-agent-dot').first().waitFor();assert.equal(await row.locator('.fw-agent-dot').first().getAttribute('title'),expected)
        assert.equal(await row.locator('.fw-agent-dot').first().getAttribute('data-outcome'),expected==='Done'?'ok':'neutral')
        if(expected!=='Unknown')assert.equal(await row.locator('.fw-row-state').innerText(),expected)
      }
      if(evidence)await page.screenshot({path:evidence+'/stopped-'+theme+'-'+width+'.png',fullPage:true})
      await page.getByRole('button',{name:'Read retained relationships',exact:true}).click()
      const graph=page.locator('[data-work-graph]')
      await graph.waitFor()
      for(const node of stoppedRecord.nodes) assert.equal(await graph.locator('[data-graph-node-id='+JSON.stringify('node:'+node.id)+']').count(),1,'Blog retained graph preserves each original identity once')
      const firstNode=graph.locator('[data-graph-node-id]').first()
      await firstNode.focus();await page.keyboard.press('Enter')
      assert.equal(await firstNode.getAttribute('aria-pressed'),'true')
      await page.keyboard.press('ArrowRight')
      assert.notEqual(await page.locator(':focus').getAttribute('data-graph-node-id'),await firstNode.getAttribute('data-graph-node-id'),'native arrows reach a related record entity')
      await graph.getByRole('button',{name:/zoom in/i}).click()
      await graph.getByRole('button',{name:/fit view/i}).click()
      if(evidence)await page.screenshot({path:evidence+'/retained-graph-'+theme+'-'+width+'.png',fullPage:true})
      assert.deepEqual(errors,[])
      checks.push({theme,width,retainedEvents:record.events.length,recordSha256:digest,captions,sourceActions})
      await page.waitForTimeout(Math.max(0,10_100-(Date.now()-began)))
      await context.close()
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true})}
  assert.equal(createHash('sha256').update(await readFile(new URL('./fixtures/waterfall-discovery-record.json',import.meta.url))).digest('hex'),digest)
  if(evidence)await writeFile(`${evidence}/checks.json`,JSON.stringify(checks,null,2)+'\n')
})
