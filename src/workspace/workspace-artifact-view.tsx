import { Markdown } from "@tangle-network/ui/markdown";
import { FileArtifactPane } from "@tangle-network/ui/files";
import { OpenUIArtifactRenderer } from "@tangle-network/ui/openui";
import { ArtifactPane } from "@tangle-network/ui/primitives";
import type { SandboxWorkbenchArtifact } from "./sandbox-workbench";

export interface WorkspaceArtifactViewProps {
  artifact: SandboxWorkbenchArtifact;
}

/** The shared technical renderer for workspace files and generated artifacts. */
export function WorkspaceArtifactView({ artifact }: WorkspaceArtifactViewProps) {
  switch (artifact.kind) {
    case "file":
      return (
        <FileArtifactPane
          path={artifact.path === artifact.filename ? undefined : artifact.path}
          filename={artifact.filename}
          content={artifact.content}
          blobUrl={artifact.blobUrl}
          mimeType={artifact.mimeType}
          onDownload={artifact.onDownload}
          tabs={artifact.tabs}
          activeTabId={artifact.activeTabId}
          onTabSelect={artifact.onTabSelect}
          onTabClose={artifact.onTabClose}
          eyebrow={artifact.eyebrow ?? null}
          meta={artifact.meta}
          toolbar={artifact.toolbar}
          footer={artifact.footer}
          hideTitleBlock={
            typeof artifact.title === "string" &&
            artifact.title === artifact.filename &&
            artifact.path === artifact.filename &&
            !artifact.eyebrow &&
            !artifact.meta
          }
        />
      );

    case "markdown":
      return (
        <ArtifactPane
          eyebrow={artifact.eyebrow ?? "Document"}
          title={artifact.title}
          subtitle={artifact.subtitle}
          meta={artifact.meta}
          headerActions={artifact.headerActions}
          toolbar={artifact.toolbar}
          footer={artifact.footer}
        >
          <div className="p-5">
            <Markdown className="prose-sm max-w-none">{artifact.content}</Markdown>
          </div>
        </ArtifactPane>
      );

    case "openui":
      return (
        <ArtifactPane
          eyebrow={artifact.eyebrow ?? "Structured Artifact"}
          title={artifact.title}
          subtitle={artifact.subtitle}
          meta={artifact.meta}
          headerActions={artifact.headerActions}
          toolbar={artifact.toolbar}
          footer={artifact.footer}
        >
          <OpenUIArtifactRenderer schema={artifact.schema} onAction={artifact.onAction} />
        </ArtifactPane>
      );

    case "custom":
      return (
        <ArtifactPane
          eyebrow={artifact.eyebrow ?? "Artifact"}
          title={artifact.title}
          subtitle={artifact.subtitle}
          meta={artifact.meta}
          headerActions={artifact.headerActions}
          toolbar={artifact.toolbar}
          footer={artifact.footer}
        >
          {artifact.content}
        </ArtifactPane>
      );
  }
}

