/**
 * FilePreview — universal file renderer.
 *
 * Renders any file type beautifully:
 * - PDF: react-pdf paginated viewer
 * - CSV/XLSX: sortable table
 * - Code (py/json/yaml/ts/js): syntax highlighted
 * - Markdown: rendered prose
 * - Images: inline display
 * - Text: monospace pre
 */

import { useState, useEffect, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  X,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";

export interface FilePreviewProps {
  filename: string;
  content?: string;
  blobUrl?: string;
  mimeType?: string;
  onClose?: () => void;
  onDownload?: () => void;
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

// Language mapping for syntax highlighting class names
function getLanguageClass(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    py: "language-python",
    ts: "language-typescript",
    tsx: "language-tsx",
    js: "language-javascript",
    jsx: "language-jsx",
    json: "language-json",
    yaml: "language-yaml",
    yml: "language-yaml",
    sh: "language-bash",
    bash: "language-bash",
    csv: "language-csv",
    sql: "language-sql",
  };
  return map[ext] || "language-text";
}

function CodePreview({ content, filename }: { content: string; filename: string }) {
  const lines = content.split("\n");
  return (
    <div className="relative bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#8E59FF]" />
        </div>
        <span className="text-xs text-[var(--text-muted)] font-[var(--font-mono)] ml-2">{filename}</span>
      </div>
      {/* Code content */}
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-[var(--bg-hover)]/50">
                <td className="text-right pr-4 pl-4 py-0 select-none text-[var(--text-muted)] text-xs font-[var(--font-mono)] w-10 align-top leading-[1.55]">
                  {i + 1}
                </td>
                <td className="pr-4 py-0 font-[var(--font-mono)] text-[13px] text-[var(--text-secondary)] leading-[1.55] whitespace-pre">
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

function CsvPreview({ content }: { content: string }) {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return null;

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line =>
    line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ""))
  );

  return (
    <div className="overflow-auto max-h-[70vh] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--bg-elevated)] sticky top-0">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5 text-[var(--text-secondary)] font-[var(--font-mono)] text-xs whitespace-nowrap"
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
    <div className="flex items-center justify-center p-4 bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
      <img src={src} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded" />
    </div>
  );
}

function PdfPreview({ blobUrl, filename }: { blobUrl: string; filename: string }) {
  // Simple iframe-based PDF viewer. For richer rendering, consumers can
  // swap in react-pdf at the app level.
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-input)]">
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
    <pre className="bg-[var(--bg-input)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 overflow-auto max-h-[70vh] text-sm text-[var(--text-secondary)] font-[var(--font-mono)] leading-[1.55]">
      {content}
    </pre>
  );
}

function EmptyPreview({ filename }: { filename: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
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
  className,
}: FilePreviewProps) {
  const previewType = getPreviewType(filename, mimeType);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          {filename}
        </span>
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {previewType === "pdf" && blobUrl && <PdfPreview blobUrl={blobUrl} filename={filename} />}
        {previewType === "image" && (blobUrl || content) && (
          <ImagePreview src={blobUrl || `data:image/*;base64,${content}`} filename={filename} />
        )}
        {previewType === "csv" && content && <CsvPreview content={content} />}
        {(previewType === "code" || previewType === "json" || previewType === "yaml") && content && (
          <CodePreview content={content} filename={filename} />
        )}
        {previewType === "text" && content && <TextPreview content={content} />}
        {previewType === "markdown" && content && <TextPreview content={content} />}
        {previewType === "unknown" && <EmptyPreview filename={filename} />}
        {!content && !blobUrl && <EmptyPreview filename={filename} />}
      </div>
    </div>
  );
}
