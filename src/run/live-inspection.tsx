import { useEffect, useState } from 'react'
import { WorkspaceFilesPane } from '../workspace/workspace-files-pane'
import { CodeView } from '../workbench/code-view'
import { DiffView } from '../workbench/diff-view'
import { useDocument } from '../hooks/use-document'

type Inspection = {
  context?: { at: string; event: { text?: string; provenance?: string } }[]
  coverage: { status: 'complete' | 'partial' | 'missing'; source: string; reason?: string }
  files?: { scope: 'workspace' | 'none'; complete: boolean; reason?: string; entries: { path: string; sha256: string; byteLength: number }[] }
  file?: { path: string; content: string; sha256: string; byteLength: number; before?: { content: string; sha256: string; byteLength: number; source: { kind: string; ref: string } } }
}

/** The graph, conversation and files share one selected agent and one product-owned API. The inspection refetches
 * when the agent's own activity moves (`activity`, its lastActivityAt from the snapshot) with a slow fallback poll —
 * not a fixed 3 s tick for an agent that may think for minutes (#525). */
export function useLiveInspection(url: string | undefined, live: boolean, fetcher?: typeof globalThis.fetch, activity?: number) {
  const gate = url ? `${url}${url.includes('?') ? '&' : '?'}activity=${activity ?? 'quiet'}` : null
  const inventory = useDocument<Inspection>(gate, live ? 30_000 : undefined, false, fetcher)
  const [selected, select] = useState<string>()
  const [download, setDownload] = useState<{ key: string; href: string }>()
  const files = inventory.error ? [] : inventory.data?.files?.entries ?? []
  const entry = files.find((file) => file.path === selected) ?? files[0]
  const fileUrl = entry && url ? `${url}/file?path=${encodeURIComponent(entry.path)}` : null
  const content = useDocument<Inspection>(fileUrl ? `${fileUrl}&activity=${activity ?? 'quiet'}` : null, live ? 30_000 : undefined, false, fetcher)
  const file = content.data?.file
  const valid = !inventory.error && !content.error && file && entry && file.path === entry.path && file.sha256 === entry.sha256 && file.byteLength === entry.byteLength
  const fileKey = valid ? `${entry.path}:${entry.sha256}` : undefined
  useEffect(() => {
    if (!fileKey || !file) return
    const href = URL.createObjectURL(new Blob([file.content], { type: 'text/plain;charset=utf-8' }))
    setDownload({ key: fileKey, href })
    return () => URL.revokeObjectURL(href)
  }, [fileKey, file?.content])
  const metadata = inventory.error ? undefined : inventory.data
  const partial = metadata?.coverage?.status === 'partial'
  const context = metadata?.context?.filter(row => row.event.text?.trim()) ?? []
  const partialFiles = metadata?.files?.scope === 'workspace' && !metadata.files.complete
  return {
    status: inventory.error ? <p className="px-3 py-2 text-sm text-muted-foreground" role="alert">Conversation inspection unavailable: {inventory.error}</p>
      : partialFiles ? <p className="px-3 py-2 text-sm text-muted-foreground" role="status">Some workspace files could not be captured.</p> : undefined,
    transcriptNote: metadata?.coverage?.status === 'missing' ? 'This worker did not record a transcript.' : undefined,
    detail: partial || context.length > 0 ? <div className="space-y-3 py-2 text-sm">
      {partial && <p className="m-0 text-muted-foreground">Only part of this conversation was recorded.</p>}
      {context.map((row, index) => <section key={`${row.at}:${index}`}>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground">{row.event.provenance === 'system-instructions' ? 'System instructions' : row.event.provenance === 'delegated-input' ? 'Task instructions' : 'Recorded context'}</h4>
        <p className="m-0 whitespace-pre-wrap break-words">{row.event.text}</p>
      </section>)}
    </div> : undefined,
    files: entry ? (
      <section aria-label="Retained files" className="flex min-h-0 flex-1 flex-col" data-file-scope={inventory.data?.files?.scope} data-file-complete={inventory.data?.files?.complete} data-file={entry.path} data-file-hash={entry.sha256}>
        {valid ? <>
          <WorkspaceFilesPane className="min-h-0 flex-1" paths={files.map(item => item.path)} selectedPath={entry.path} onSelect={path => { if (files.some(item => item.path === path)) select(path) }} preview={{ path: entry.path, content: <CodeView path={entry.path} filename={entry.path.split('/').at(-1) ?? entry.path} content={file.content} showTree={false} />, ...(file.before ? { compare: { label: file.before.source.ref, content: <DiffView filename={entry.path} baseline={file.before.content} current={file.content} /> } } : {}) }} />
          <details className="ws-status"><summary>Provenance</summary><code className="break-all">{entry.sha256}</code>{file.before && <p>Compared with {file.before.source.kind} <code className="break-all">{file.before.source.ref}</code>: <code className="break-all">{file.before.sha256}</code></p>}<p><a href={download && download.key === fileKey ? download.href : undefined} download={entry.path.split('/').at(-1)}>Download</a></p></details>
        </> : <p className="ws-status" role={content.loading ? 'status' : 'alert'}>{content.loading ? `Reading ${entry.path}…` : `This retained file is unavailable: ${content.error ?? 'its content identity did not match the inventory'}`}</p>}
      </section>
    ) : undefined,
  }
}
