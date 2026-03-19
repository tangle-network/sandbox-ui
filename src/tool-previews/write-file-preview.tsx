import { memo } from "react";
import { FileEdit } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { CodeBlock, CopyButton } from "../markdown/code-block";
import { PreviewCard, PreviewError, PreviewLoading } from "./preview-primitives";

export interface WriteFilePreviewProps {
  part: ToolPart;
}

function extractWriteContent(
  input: unknown,
): { path: string; content: string } | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const path = String(obj.file_path ?? obj.path ?? obj.filePath ?? "unknown");
  const content = String(obj.content ?? obj.contents ?? obj.data ?? "");
  return { path, content };
}

function getLanguageFromPath(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    rs: "rust",
    py: "python",
    go: "go",
    rb: "ruby",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    sol: "solidity",
    proto: "protobuf",
  };
  return ext ? map[ext] : undefined;
}

/**
 * Preview for file write/create operations.
 * Shows file path, line count, and the written content.
 */
export const WriteFilePreview = memo(({ part }: WriteFilePreviewProps) => {
  const write = extractWriteContent(part.state.input);
  if (!write) return null;

  const lineCount = write.content.split("\n").length;
  const language = getLanguageFromPath(write.path);

  return (
    <PreviewCard
      icon={<FileEdit className="h-4 w-4" />}
      title="Write file"
      description={write.path}
      meta={
        <span className="text-xs text-[var(--text-muted)]">
          +{lineCount} line{lineCount !== 1 ? "s" : ""}
        </span>
      }
    >
      {part.state.status === "running" ? <PreviewLoading label="Writing file…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      <CodeBlock code={write.content} language={language} className="rounded-[var(--radius-md)]">
        <CopyButton text={write.content} />
      </CodeBlock>
    </PreviewCard>
  );
});
WriteFilePreview.displayName = "WriteFilePreview";
