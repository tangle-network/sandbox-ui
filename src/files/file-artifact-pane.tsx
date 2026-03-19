import { Download, X } from "lucide-react";
import { ArtifactPane, type ArtifactPaneProps } from "../workspace/artifact-pane";
import { FilePreview, type FilePreviewProps } from "./file-preview";
import { FileTabs, type FileTabData } from "./file-tabs";

export interface FileArtifactPaneProps extends Omit<FilePreviewProps, "className"> {
  path?: string;
  tabs?: FileTabData[];
  activeTabId?: string;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
  eyebrow?: ArtifactPaneProps["eyebrow"];
  meta?: ArtifactPaneProps["meta"];
  toolbar?: ArtifactPaneProps["toolbar"];
  footer?: ArtifactPaneProps["footer"];
  className?: string;
}

/**
 * FileArtifactPane — opinionated artifact frame for file previews with tabs and
 * header actions.
 */
export function FileArtifactPane({
  filename,
  content,
  blobUrl,
  mimeType,
  onClose,
  onDownload,
  path,
  tabs = [],
  activeTabId,
  onTabSelect,
  onTabClose,
  eyebrow = "Artifact",
  meta,
  toolbar,
  footer,
  className,
}: FileArtifactPaneProps) {
  const showTabs = tabs.length > 0 && onTabSelect && onTabClose;

  return (
    <ArtifactPane
      eyebrow={eyebrow}
      title={filename}
      subtitle={path}
      meta={meta}
      toolbar={toolbar}
      footer={footer}
      className={className}
      tabs={
        showTabs ? (
          <FileTabs
            tabs={tabs}
            activeId={activeTabId}
            onSelect={onTabSelect}
            onClose={onTabClose}
          />
        ) : undefined
      }
      headerActions={
        <>
          {onDownload && (
            <button
              type="button"
              aria-label={`Download ${filename}`}
              onClick={onDownload}
              className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label={`Close ${filename}`}
              onClick={onClose}
              className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </>
      }
    >
      <FilePreview
        filename={filename}
        content={content}
        blobUrl={blobUrl}
        mimeType={mimeType}
        hideHeader={true}
      />
    </ArtifactPane>
  );
}
