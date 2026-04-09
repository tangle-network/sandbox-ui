"use client"

import * as React from "react"
import { Camera, Clock, HardDrive, Plus, RotateCcw } from "lucide-react"
import { cn } from "../lib/utils"

export interface SnapshotInfo {
  id: string
  createdAt: string
  sizeBytes?: number
  tags?: string[]
}

export interface SnapshotListProps {
  snapshots: SnapshotInfo[]
  onCreate: (tags?: string[]) => void
  onRestore: (snapshotId: string) => void
  onSaveAsTemplate?: (snapshotId: string) => void
  loading?: boolean
  className?: string
}

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes < 0) return "-"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function SnapshotList({ snapshots, onCreate, onRestore, onSaveAsTemplate, loading = false, className }: SnapshotListProps) {
  const [showCreate, setShowCreate] = React.useState(false)
  const [tags, setTags] = React.useState("")

  const handleCreate = () => {
    const tagList = tags.trim() ? tags.trim().split(",").map((t) => t.trim()).filter(Boolean) : undefined
    onCreate(tagList)
    setTags("")
    setShowCreate(false)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Snapshots</h3>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Snapshot
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm text-foreground font-medium">Create a new snapshot of the current sandbox state.</p>
          <input
            type="text"
            placeholder="Tags (comma-separated, optional)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Camera className="h-3 w-3 mr-1.5 inline" />
              Create
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Camera className="mx-auto h-6 w-6 text-muted-foreground animate-pulse mb-2" />
          <p className="text-sm text-muted-foreground">Loading snapshots...</p>
        </div>
      ) : snapshots.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Size</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tags</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{s.id.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatDate(s.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(s.sizeBytes)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.tags?.length ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {s.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onRestore(s.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors border border-border"
                        title="Restore to new sandbox"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                      {onSaveAsTemplate && (
                        <button
                          type="button"
                          onClick={() => onSaveAsTemplate(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                          title="Save as reusable template"
                        >
                          Save as Template
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No snapshots yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a snapshot to save the current state of your sandbox.</p>
        </div>
      )}
    </div>
  )
}
