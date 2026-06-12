import * as React from "react";
import { Button, Input, Textarea, Label } from "@tangle-network/ui/primitives";
import { MessageSquare, Save, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { EmailPreview } from "./preview/email-preview";
import { ImagePreview } from "./preview/image-preview";
import { VideoPreview } from "./preview/video-preview";
import { CopyPreview } from "./preview/copy-preview";
import type { BrandTokens, AssetSpec, EmailContent, CopyContent } from "./types";

export interface AssetEditorProps {
  spec: AssetSpec;
  previewUrl?: string;
  isRendering?: boolean;
  onSave?: (spec: AssetSpec) => void;
  onRenderRequest?: () => void;
  onRevisionRequest?: (instruction: string) => void;
  className?: string;
}

function BrandPanel({ brand, onChange }: { brand: BrandTokens; onChange: (brand: BrandTokens) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-border rounded">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        Brand tokens
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          {(["primaryColor", "accentColor", "textColor"] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={brand[key]}
                onChange={(e) => onChange({ ...brand, [key]: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0"
              />
              <Label className="text-xs capitalize">{key.replace(/Color/, " color")}</Label>
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Font family</Label>
            <Input
              value={brand.fontFamily}
              onChange={(e) => onChange({ ...brand, fontFamily: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Logo URL</Label>
            <Input
              value={brand.logoUrl ?? ""}
              onChange={(e) => onChange({ ...brand, logoUrl: e.target.value || undefined })}
              className="h-7 text-xs"
              placeholder="https://…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmailEditor({ spec, onChange }: { spec: AssetSpec<"email">; onChange: (spec: AssetSpec<"email">) => void }) {
  const content = spec.content;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Input
          value={content.subject}
          onChange={(e) => onChange({ ...spec, content: { ...content, subject: e.target.value } })}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Preheader</Label>
        <Input
          value={content.preheader ?? ""}
          onChange={(e) => onChange({ ...spec, content: { ...content, preheader: e.target.value || undefined } })}
          className="h-8 text-sm"
          placeholder="Preview text…"
        />
      </div>
      {content.sections.map((section, i) => {
        if (section.type === "hero" || section.type === "body" || section.type === "cta") {
          const textField = section.type === "body" ? "text" : section.type === "cta" ? "label" : "headline";
          const val = (section as unknown as Record<string, string>)[textField] ?? "";
          return (
            <div key={i} className="space-y-1">
              <Label className="text-xs capitalize">{section.type} — {textField}</Label>
              <Textarea
                value={val}
                onChange={(e) => {
                  const updated = [...content.sections];
                  updated[i] = { ...updated[i], [textField]: e.target.value } as EmailContent["sections"][number];
                  onChange({ ...spec, content: { ...content, sections: updated } });
                }}
                className="text-sm min-h-[60px]"
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function CopyEditor({ spec, onChange }: { spec: AssetSpec<"copy:caption" | "copy:headline" | "copy:sms">; onChange: (spec: AssetSpec<"copy:caption" | "copy:headline" | "copy:sms">) => void }) {
  const content = spec.content;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Headline</Label>
        <Input
          value={content.headline}
          onChange={(e) => onChange({ ...spec, content: { ...content, headline: e.target.value } })}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Body</Label>
        <Textarea
          value={content.body}
          onChange={(e) => onChange({ ...spec, content: { ...content, body: e.target.value } })}
          className="text-sm min-h-[80px]"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hashtags (comma-separated)</Label>
        <Input
          value={(content.hashtags ?? []).join(", ")}
          onChange={(e) => onChange({ ...spec, content: { ...content, hashtags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) } })}
          className="h-8 text-sm"
          placeholder="marketing, growth, saas"
        />
      </div>
    </div>
  );
}

function Preview({ spec, previewUrl, isRendering, onRenderRequest }: {
  spec: AssetSpec;
  previewUrl?: string;
  isRendering?: boolean;
  onRenderRequest?: () => void;
}) {
  const { format, brand, content } = spec;
  if (format === "email") return <EmailPreview content={content as EmailContent} brand={brand} previewUrl={previewUrl} />;
  if (format.startsWith("image:")) {
    const imgFormat = format === "image:story" ? "story" : format === "image:carousel" ? "carousel" : "feed";
    return <ImagePreview content={content as import("./types").ImageContent} brand={brand} format={imgFormat} />;
  }
  if (format.startsWith("video:")) {
    return <VideoPreview content={content as import("./types").VideoContent} brand={brand} onRenderRequest={onRenderRequest} isRendering={isRendering} />;
  }
  if (format.startsWith("copy:")) {
    return <CopyPreview content={content as CopyContent} />;
  }
  return null;
}

export function AssetEditor({ spec, previewUrl, isRendering, onSave, onRenderRequest, onRevisionRequest, className }: AssetEditorProps) {
  const [draft, setDraft] = React.useState(spec);
  const [revisionInput, setRevisionInput] = React.useState("");
  const isDirty = JSON.stringify(draft) !== JSON.stringify(spec);
  React.useEffect(() => {
    setDraft(spec);
  }, [spec]);
  const handleRevision = () => {
    if (!revisionInput.trim()) return;
    onRevisionRequest?.(revisionInput.trim());
    setRevisionInput("");
  };
  return (
    <div className={cn("grid grid-cols-2 gap-4 h-full min-h-0", className)}>
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{draft.format}</span>
          {isDirty && onSave && (
            <Button size="sm" variant="default" onClick={() => onSave(draft)} className="h-7 gap-1.5 text-xs">
              <Save size={12} />
              Save
            </Button>
          )}
        </div>
        {draft.format === "email" && (
          <EmailEditor spec={draft as AssetSpec<"email">} onChange={(s) => setDraft(s as AssetSpec)} />
        )}
        {(draft.format === "copy:caption" || draft.format === "copy:headline" || draft.format === "copy:sms") && (
          <CopyEditor spec={draft as AssetSpec<"copy:caption" | "copy:headline" | "copy:sms">} onChange={(s) => setDraft(s as AssetSpec)} />
        )}
        <BrandPanel brand={draft.brand} onChange={(b) => setDraft((d) => ({ ...d, brand: b }))} />
        {onRevisionRequest && (
          <div className="space-y-1.5">
            <Label className="text-xs">Ask agent to revise</Label>
            <div className="flex gap-1.5">
              <Input
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                placeholder="Make the CTA more urgent…"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRevision();
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleRevision}
                disabled={!revisionInput.trim()}
                className="h-8 px-2"
              >
                <MessageSquare size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="overflow-y-auto">
        <Preview
          spec={draft}
          previewUrl={previewUrl}
          isRendering={isRendering}
          onRenderRequest={onRenderRequest}
        />
      </div>
    </div>
  );
}
