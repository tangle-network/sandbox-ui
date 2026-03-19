import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Boxes,
  FileCode2,
  FileText,
  FolderTree,
  LayoutPanelTop,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { EmptyState } from "../primitives/empty-state";
import { Markdown } from "../markdown/markdown";
import { ChatContainer, type ChatContainerProps } from "../chat/chat-container";
import { FileArtifactPane } from "../files/file-artifact-pane";
import type { FileTabData } from "../files/file-tabs";
import { OpenUIArtifactRenderer, type OpenUIAction, type OpenUIComponentNode } from "../openui/openui-artifact-renderer";
import { ArtifactPane } from "./artifact-pane";
import { DirectoryPane, type DirectoryPaneProps } from "./directory-pane";
import { RuntimePane, type RuntimePaneProps } from "./runtime-pane";
import { WorkspaceLayout, type WorkspaceLayoutProps } from "./workspace-layout";

interface SandboxWorkbenchArtifactBase {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
}

export interface SandboxWorkbenchFileArtifact extends SandboxWorkbenchArtifactBase {
  kind: "file";
  path: string;
  filename: string;
  content?: string;
  blobUrl?: string;
  mimeType?: string;
  onDownload?: () => void;
  tabs?: FileTabData[];
  activeTabId?: string;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
}

export interface SandboxWorkbenchMarkdownArtifact extends SandboxWorkbenchArtifactBase {
  kind: "markdown";
  content: string;
}

export interface SandboxWorkbenchOpenUIArtifact extends SandboxWorkbenchArtifactBase {
  kind: "openui";
  schema: OpenUIComponentNode | OpenUIComponentNode[];
  onAction?: (action: OpenUIAction) => void;
}

export interface SandboxWorkbenchCustomArtifact extends SandboxWorkbenchArtifactBase {
  kind: "custom";
  content: ReactNode;
}

export type SandboxWorkbenchArtifact =
  | SandboxWorkbenchCustomArtifact
  | SandboxWorkbenchFileArtifact
  | SandboxWorkbenchMarkdownArtifact
  | SandboxWorkbenchOpenUIArtifact;

export interface SandboxWorkbenchSessionProps extends Omit<ChatContainerProps, "className"> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
}

export interface SandboxWorkbenchLayoutOptions
  extends Pick<
    WorkspaceLayoutProps,
    | "defaultBottomOpen"
    | "defaultLeftOpen"
    | "defaultLeftWidth"
    | "defaultRightOpen"
    | "defaultRightWidth"
    | "density"
    | "maxLeftWidth"
    | "maxRightWidth"
    | "minLeftWidth"
    | "minRightWidth"
    | "persistenceKey"
    | "resizable"
    | "theme"
  > {}

export interface SandboxWorkbenchProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  directory?: DirectoryPaneProps;
  session: SandboxWorkbenchSessionProps;
  artifacts?: SandboxWorkbenchArtifact[];
  activeArtifactId?: string;
  onArtifactChange?: (artifactId: string) => void;
  onArtifactClose?: (artifactId: string) => void;
  runtime?: RuntimePaneProps;
  layout?: SandboxWorkbenchLayoutOptions;
  emptyArtifactState?: ReactNode;
  className?: string;
}

function getArtifactTabIcon(kind: SandboxWorkbenchArtifact["kind"]) {
  switch (kind) {
    case "file":
      return FileCode2;
    case "markdown":
      return FileText;
    case "openui":
      return LayoutPanelTop;
    case "custom":
      return Boxes;
  }
}

function artifactTabLabel(artifact: SandboxWorkbenchArtifact) {
  if (typeof artifact.title === "string") return artifact.title;
  if (artifact.kind === "file") return artifact.filename;
  return "Artifact";
}

function ArtifactTabs({
  artifacts,
  activeArtifactId,
  onSelect,
  onClose,
}: {
  artifacts: SandboxWorkbenchArtifact[];
  activeArtifactId?: string;
  onSelect: (artifactId: string) => void;
  onClose?: (artifactId: string) => void;
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-dark)]">
      {artifacts.map((artifact) => {
        const Icon = getArtifactTabIcon(artifact.kind);
        const isActive = artifact.id === activeArtifactId;

        return (
          <div
            key={artifact.id}
            className={cn(
              "group flex shrink-0 items-center border-r border-[var(--border-subtle)]",
              isActive
                ? "border-b-2 border-b-[var(--brand-cool)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(artifact.id)}
              className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs transition-colors hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-cool)]/60"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[14rem] truncate">{artifactTabLabel(artifact)}</span>
            </button>
            {onClose && (
              <button
                type="button"
                aria-label={`Close ${artifactTabLabel(artifact)}`}
                onClick={() => onClose(artifact.id)}
                className="mr-1 rounded p-1 opacity-0 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderArtifact(artifact: SandboxWorkbenchArtifact) {
  switch (artifact.kind) {
    case "file":
      return (
        <FileArtifactPane
          path={artifact.path}
          filename={artifact.filename}
          content={artifact.content}
          blobUrl={artifact.blobUrl}
          mimeType={artifact.mimeType}
          onDownload={artifact.onDownload}
          tabs={artifact.tabs}
          activeTabId={artifact.activeTabId}
          onTabSelect={artifact.onTabSelect}
          onTabClose={artifact.onTabClose}
          eyebrow={artifact.eyebrow}
          meta={artifact.meta}
          toolbar={artifact.toolbar}
          footer={artifact.footer}
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

/**
 * SandboxWorkbench — high-level composition that turns sandbox-ui primitives
 * into a complete session surface: directory, agent timeline, artifacts, and
 * runtime in one reusable shell.
 */
export function SandboxWorkbench({
  title = "Sandbox session",
  subtitle,
  status,
  directory,
  session,
  artifacts = [],
  activeArtifactId,
  onArtifactChange,
  onArtifactClose,
  runtime,
  layout,
  emptyArtifactState,
  className,
}: SandboxWorkbenchProps) {
  const [uncontrolledArtifactId, setUncontrolledArtifactId] = useState<string | undefined>(
    activeArtifactId ?? artifacts[0]?.id,
  );

  useEffect(() => {
    if (activeArtifactId !== undefined) return;

    setUncontrolledArtifactId((current) => {
      if (artifacts.length === 0) return undefined;
      if (current && artifacts.some((artifact) => artifact.id === current)) return current;
      return artifacts[0]?.id;
    });
  }, [activeArtifactId, artifacts]);

  const resolvedArtifactId = activeArtifactId ?? uncontrolledArtifactId;
  const activeArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === resolvedArtifactId),
    [artifacts, resolvedArtifactId],
  );

  const handleArtifactChange = (artifactId: string) => {
    if (activeArtifactId === undefined) {
      setUncontrolledArtifactId(artifactId);
    }

    onArtifactChange?.(artifactId);
  };

  const centerHeader = (
    <div className="flex min-w-0 items-start justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(98,114,243,0.12),rgba(255,255,255,0.02)_38%,transparent_72%)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-cool)]">
          Tangle Sandbox
        </div>
        <div className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</div>
        {subtitle && <div className="truncate text-sm text-[var(--text-muted)]">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {status}
        {artifacts.length > 0 && <Badge variant="outline">{artifacts.length} artifacts</Badge>}
      </div>
    </div>
  );

  const center = (
    <ArtifactPane
      eyebrow={session.eyebrow ?? "Agent Session"}
      title={session.title ?? "Execution timeline"}
      subtitle={session.subtitle}
      meta={session.meta}
      headerActions={session.headerActions}
      className="h-full"
      contentClassName="bg-[radial-gradient(circle_at_top,rgba(82,164,255,0.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]"
    >
      <ChatContainer
        {...session}
        className="h-full"
        presentation={session.presentation ?? "timeline"}
      />
    </ArtifactPane>
  );

  const right = artifacts.length > 0 ? (
    <section className="flex h-full min-h-0 flex-col bg-[var(--bg-dark)]">
      <ArtifactTabs
        artifacts={artifacts}
        activeArtifactId={resolvedArtifactId}
        onSelect={handleArtifactChange}
        onClose={onArtifactClose}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
        {activeArtifact ? (
          renderArtifact(activeArtifact)
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            {emptyArtifactState ?? (
              <EmptyState
                icon={<Boxes className="h-8 w-8" />}
                title="No artifact selected"
                description="Select a generated artifact, file preview, or OpenUI panel to inspect it here."
              />
            )}
          </div>
        )}
      </div>
    </section>
  ) : null;

  return (
    <WorkspaceLayout
      left={directory ? <DirectoryPane {...directory} className="h-full" /> : undefined}
      leftHeader={
        directory ? (
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <FolderTree className="h-3.5 w-3.5" />
            Directory
          </div>
        ) : undefined
      }
      center={center}
      centerHeader={centerHeader}
      right={right}
      rightHeader={
        right ? (
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <LayoutPanelTop className="h-3.5 w-3.5" />
            Artifacts
          </div>
        ) : undefined
      }
      bottom={runtime ? <RuntimePane {...runtime} className="h-full" /> : undefined}
      theme={layout?.theme ?? "operator"}
      density={layout?.density ?? "comfortable"}
      persistenceKey={layout?.persistenceKey}
      defaultLeftOpen={layout?.defaultLeftOpen ?? Boolean(directory)}
      defaultRightOpen={layout?.defaultRightOpen ?? artifacts.length > 0}
      defaultBottomOpen={layout?.defaultBottomOpen ?? Boolean(runtime)}
      defaultLeftWidth={layout?.defaultLeftWidth}
      defaultRightWidth={layout?.defaultRightWidth}
      minLeftWidth={layout?.minLeftWidth}
      maxLeftWidth={layout?.maxLeftWidth}
      minRightWidth={layout?.minRightWidth}
      maxRightWidth={layout?.maxRightWidth}
      resizable={layout?.resizable}
      className={cn("p-3 lg:p-4", className)}
    />
  );
}

export function AgentWorkbench(props: SandboxWorkbenchProps) {
  return (
    <SandboxWorkbench
      {...props}
      session={{
        ...props.session,
        eyebrow: props.session.eyebrow ?? "Agent Session",
        title: props.session.title ?? (
          <span className="inline-flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--brand-cool)]" />
            Execution timeline
          </span>
        ),
      }}
    />
  );
}
