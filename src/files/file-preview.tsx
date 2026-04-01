/**
 * FilePreview — universal file renderer.
 *
 * Renders any file type beautifully:
 * - PDF: embedded viewer
 * - CSV/XLSX: tabular preview
 * - Code (py/json/yaml/ts/js): line-numbered viewer
 * - Markdown: rendered prose
 * - Images: inline display
 * - Text: monospace preview
 */

import {
  Download,
  X,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Markdown } from "../markdown/markdown";

export interface FilePreviewProps {
  filename: string;
  content?: string;
  blobUrl?: string;
  mimeType?: string;
  onClose?: () => void;
  onDownload?: () => void;
  hideHeader?: boolean;
  className?: string;
}

function getPreviewType(filename: string, mimeType?: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (mimeType?.startsWith("application/pdf") || ext === "pdf") return "pdf";
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["csv"].includes(ext)) return "csv";
  if (["xlsx", "xls"].includes(ext)) return "spreadsheet";
  if (["py", "ts", "js", "tsx", "jsx", "sh", "bash"].includes(ext)) return "code";
  if (["json"].includes(ext)) return "json";
  if (["yaml", "yml"].includes(ext)) return "yaml";
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (["txt", "log", "text"].includes(ext)) return "text";
  return "unknown";
}

function getPreviewLabel(previewType: string) {
  switch (previewType) {
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "csv":
      return "CSV";
    case "spreadsheet":
      return "Spreadsheet";
    case "code":
      return "Code";
    case "json":
      return "JSON";
    case "yaml":
      return "YAML";
    case "markdown":
      return "Markdown";
    case "text":
      return "Text";
    default:
      return "File";
  }
}

function CodePreview({ content, filename }: { content: string; filename: string }) {
  const lines = content.split("\n");
  const language = filename.split(".").pop()?.toUpperCase() || "TXT";

  return (
    <div className="relative bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#8E59FF]" />
        </div>
        <div className="ml-2 min-w-0 flex-1 truncate text-xs font-[var(--font-mono)] text-muted-foreground">
          {filename}
        </div>
        <div className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>{language}</span>
          <span className="h-1 w-1 rounded-full bg-[var(--border-hover)]" />
          <span>{lines.length} lines</span>
        </div>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-accent">
                <td className="text-right pr-4 pl-4 py-0 select-none text-muted-foreground text-xs font-[var(--font-mono)] w-10 align-top leading-[1.55]">
                  {i + 1}
                </td>
                <td className="pr-4 py-0 font-[var(--font-mono)] text-[13px] text-foreground leading-[1.55] whitespace-pre">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseCsvRow(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function CsvPreview({ content }: { content: string }) {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length === 0) return null;

  const headers = parseCsvRow(lines[0]).map((header) => header.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) =>
    parseCsvRow(line).map((cell) => cell.replace(/^"|"$/g, "")),
  );

  return (
    <div className="overflow-auto max-h-[70vh] rounded-[var(--radius-md)] border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 sticky top-0">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-semibold text-foreground border-b border-border whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border hover:bg-accent">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5 text-foreground font-[var(--font-mono)] text-xs whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImagePreview({ src, filename }: { src: string; filename: string }) {
  return (
    <div className="flex items-center justify-center p-4 bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-border">
      <img src={src} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded" />
    </div>
  );
}

function PdfPreview({ blobUrl, filename }: { blobUrl: string; filename: string }) {
  // Simple iframe-based PDF viewer. For richer rendering, consumers can
  // swap in react-pdf at the app level.
  return (
    <div className="rounded-[var(--radius-md)] border border-border overflow-hidden bg-[var(--bg-input)]">
      <iframe
        src={blobUrl}
        title={filename}
        className="w-full h-[70vh] border-0"
      />
    </div>
  );
}

function TextPreview({ content }: { content: string }) {
  return (
    <pre className="bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-border p-4 overflow-auto max-h-[70vh] text-sm text-foreground font-[var(--font-mono)] leading-[1.55]">
      {content}
    </pre>
  );
}

function UnsupportedPreview({
  filename,
  title,
  description,
}: {
  filename: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-[var(--bg-input)] px-6 py-16 text-center text-muted-foreground">
      <FileText className="mb-3 h-12 w-12 opacity-30" />
      <p className="text-sm text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs">{description}</p>
      <p className="mt-4 text-[11px] uppercase tracking-[0.12em]">{filename}</p>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-input)] p-5">
      <Markdown className="prose-sm max-w-none">{content}</Markdown>
    </div>
  );
}

function EmptyPreview({ filename }: { filename: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <FileText className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Cannot preview {filename}</p>
      <p className="text-xs mt-1">Download to view this file</p>
    </div>
  );
}

export function FilePreview({
  filename,
  content,
  blobUrl,
  mimeType,
  onClose,
  onDownload,
  hideHeader = false,
  className,
}: FilePreviewProps) {
  const previewType = getPreviewType(filename, mimeType);
  const previewLabel = getPreviewLabel(previewType);
  const hasRenderableSource =
    Boolean(content) ||
    Boolean(blobUrl) ||
    previewType === "unknown" ||
    previewType === "spreadsheet";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {!hideHeader && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{filename}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {previewLabel}
            </div>
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              aria-label={`Download ${filename}`}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${filename}`}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        {previewType === "pdf" && blobUrl && <PdfPreview blobUrl={blobUrl} filename={filename} />}
        {previewType === "image" && blobUrl && <ImagePreview src={blobUrl} filename={filename} />}
        {previewType === "csv" && content && <CsvPreview content={content} />}
        {(previewType === "code" || previewType === "json" || previewType === "yaml") && content && (
          <CodePreview content={content} filename={filename} />
        )}
        {previewType === "text" && content && <TextPreview content={content} />}
        {previewType === "markdown" && content && <MarkdownPreview content={content} />}
        {previewType === "spreadsheet" && (
          <UnsupportedPreview
            filename={filename}
            title="Spreadsheet preview is not available in this surface"
            description="Download the workbook or convert it to CSV when you need an inline preview."
          />
        )}
        {previewType === "unknown" && <EmptyPreview filename={filename} />}
        {!hasRenderableSource && (
          <UnsupportedPreview
            filename={filename}
            title="Preview data is not available yet"
            description="This artifact can be shown once the app provides inline content or a downloadable blob."
          />
        )}
      </div>
    </div>
  );
}
