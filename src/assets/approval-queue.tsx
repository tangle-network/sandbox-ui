import * as React from "react";
import { Button, Input } from "@tangle-network/ui/primitives";
import { Search, CheckCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { AssetCard } from "./asset-card";
import { AssetEditor } from "./asset-editor";
import type { AssetSpec } from "./types";

export interface ApprovalQueueProps {
  assets: AssetSpec[];
  variantCounts?: Record<string, number>;
  onApprove?: (id: string, scheduledAt?: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
  onSave?: (spec: AssetSpec) => void;
  onRevisionRequest?: (id: string, instruction: string) => void;
  onRenderRequest?: (id: string) => void;
  renderingIds?: Set<string>;
  previewUrls?: Record<string, string>;
  className?: string;
}

const FORMAT_OPTIONS = [
  { value: "all", label: "All formats" },
  { value: "email", label: "Email" },
  { value: "image:feed", label: "Feed image" },
  { value: "image:story", label: "Story" },
  { value: "image:carousel", label: "Carousel" },
  { value: "video:reel", label: "Reel" },
  { value: "video:feed", label: "Video" },
  { value: "copy:caption", label: "Caption" },
  { value: "copy:headline", label: "Headline" },
  { value: "copy:sms", label: "SMS" }
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" }
];

export function ApprovalQueue({
  assets,
  variantCounts = {},
  onApprove,
  onReject,
  onEdit,
  onSave,
  onRevisionRequest,
  onRenderRequest,
  renderingIds = new Set(),
  previewUrls = {},
  className
}: ApprovalQueueProps) {
  const [search, setSearch] = React.useState("");
  const [formatFilter, setFormatFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("pending_review");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = React.useState("");
  const filtered = assets.filter((a) => {
    if (formatFilter !== "all" && a.format !== formatFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.id.includes(q) && !a.format.includes(q) && !a.brand.businessName.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const pendingCount = assets.filter((a) => a.status === "pending_review").length;
  const handleBulkApprove = () => {
    filtered.filter((a) => a.status === "pending_review").forEach((a) => onApprove?.(a.id, scheduleDate || undefined));
  };
  const editingSpec = editingId ? assets.find((a) => a.id === editingId) : null;
  if (editingSpec) {
    return (
      <div className={cn("flex flex-col gap-3 h-full", className)}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to queue
          </button>
          <div className="flex gap-2">
            {onReject && editingSpec.status === "pending_review" && (
              <Button size="sm" variant="outline" onClick={() => {
                onReject(editingSpec.id);
                setEditingId(null);
              }}>Reject</Button>
            )}
            {onApprove && editingSpec.status === "pending_review" && (
              <Button size="sm" onClick={() => {
                onApprove(editingSpec.id, scheduleDate || undefined);
                setEditingId(null);
              }}>Approve</Button>
            )}
          </div>
        </div>
        <AssetEditor
          spec={editingSpec}
          previewUrl={previewUrls[editingSpec.id]}
          isRendering={renderingIds.has(editingSpec.id)}
          onSave={(s) => {
            onSave?.(s);
            setEditingId(null);
          }}
          onRenderRequest={() => onRenderRequest?.(editingSpec.id)}
          onRevisionRequest={(instr) => onRevisionRequest?.(editingSpec.id, instr)}
          className="flex-1"
        />
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter assets…"
            className="h-8 pl-7 text-sm"
          />
        </div>
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded border border-input bg-background"
        >
          {FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded border border-input bg-background"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {pendingCount > 0 && onApprove && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="h-8 px-2 text-xs rounded border border-input bg-background w-32"
            />
            <Button size="sm" variant="outline" onClick={handleBulkApprove} className="h-8 gap-1.5 text-xs">
              <CheckCheck size={13} />
              Approve all ({pendingCount})
            </Button>
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No assets match your filters.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((a) => (
            <AssetCard
              key={a.id}
              spec={a}
              variantCount={variantCounts[a.id]}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={() => setEditingId(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
