/** Bundle the already-built LiveRun export once for native Runtime's existing asset-directory contract. */
import { build } from 'vite'
import { appendFile } from 'node:fs/promises'
const compiled = await build({
  configFile: false, define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/runtime-viewer.mjs', formats: ['es'], fileName: () => 'workspace-viewer.js' },
    rolldownOptions: { output: { chunkFileNames: 'runtime-viewer/[name]-[hash].js', assetFileNames: 'runtime-viewer/[name]-[hash][extname]' } },
  },
})
const css = [compiled].flat().flatMap(result => result.output).filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString()).join('\n')
if (css) await appendFile('dist/styles.css', '\n' + css)

// The retained report keeps its single-file, offline hydration contract.
await build({ configFile: false, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { emptyOutDir: false, lib: { entry: 'src/record/standalone.tsx', formats: ['iife'], name: 'AgentResearchReport', fileName: () => 'report-viewer.js' } } })
