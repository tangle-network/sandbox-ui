import * as React from "react";
import {
  Button,
  DatePicker,
  FilterField,
  Input,
  localToday,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Toolbar,
} from "@tangle-network/ui/primitives";
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
  /** Opens one asset's detail view, with the ids the queue shows, in order, for previous and next. */
  onOpen?: (id: string, visibleIds: string[]) => void;
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
  onOpen,
  renderingIds = new Set(),
  previewUrls = {},
  className
}: ApprovalQueueProps) {
  const [search, setSearch] = React.useState("");
  const [formatFilter, setFormatFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("pending_review");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = React.useState("");
  const formatId = React.useId();
  const statusId = React.useId();
  const scheduleId = React.useId();
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
      {/* One Toolbar row: shared Select and DatePicker on the raised field
          surface, labelled filters, and the bulk action pinned to the end. */}
      <Toolbar
        className="mb-0"
        search={
          <div className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter assets…"
              aria-label="Filter assets"
              className="pl-9"
            />
          </div>
        }
        filters={
          <>
            <FilterField label="Format" htmlFor={formatId}>
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger id={formatId} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Status" htmlFor={statusId}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id={statusId} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            {pendingCount > 0 && onApprove && (
              <FilterField label="Schedule for" htmlFor={scheduleId}>
                <DatePicker
                  id={scheduleId}
                  className="w-40"
                  placeholder="Not scheduled"
                  min={localToday()}
                  value={scheduleDate}
                  onChange={setScheduleDate}
                />
              </FilterField>
            )}
          </>
        }
        actions={pendingCount > 0 && onApprove ? (
          <Button variant="outline" onClick={handleBulkApprove}>
            <CheckCheck />
            Approve all ({pendingCount})
          </Button>
        ) : undefined}
      />
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
              onOpen={onOpen ? (id) => onOpen(id, filtered.map((asset) => asset.id)) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
