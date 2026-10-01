import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Boxes,
  FileCode2,
  FileText,
  FolderTree,
  LayoutPanelTop,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { EmptyState } from "@tangle-network/ui/primitives";
import { Markdown } from "@tangle-network/ui/markdown";
import { ChatContainer, type ChatContainerProps } from "@tangle-network/ui/chat";
import { FileArtifactPane } from "@tangle-network/ui/files";
import type { FileTabData } from "@tangle-network/ui/files";
import { OpenUIArtifactRenderer, type OpenUIAction, type OpenUIComponentNode } from "@tangle-network/ui/openui";
import { ArtifactPane } from "@tangle-network/ui/primitives";
import { DirectoryPane, type DirectoryPaneProps } from "./directory-pane";
import { RuntimePane, type RuntimePaneProps } from "./runtime-pane";
import { WorkspaceLayout, type WorkspaceLayoutProps } from "./workspace-layout";
import { WorkspacePaneHeader } from "./workspace-pane-header";
import { focusRing, focusRingInset } from "@tangle-network/ui/utils";

export type SandboxWorkbenchPlacement = "left" | "right" | "bottom" | "hidden";
type SandboxWorkbenchRegion = Exclude<SandboxWorkbenchPlacement, "hidden">;

interface SandboxWorkbenchArtifactBase {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  /** Tab glyph. Defaults per `kind`; a `custom` artifact usually names its own. */
  icon?: LucideIcon;
  /** A pinned artifact's tab sorts before the rest and carries no close button. */
  pinned?: boolean;
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
  /**
   * Controls rendered above the composer in the same centered column —
   * harness/model/effort pickers, token meters, etc. Use
   * `AgentSessionControls` from `@tangle-network/agent-app/web-react` for the
   * standard set.
   */
  composerControls?: ReactNode;
  renderRunActions?: ChatContainerProps["renderRunActions"];
  renderUserMessageActions?: ChatContainerProps["renderUserMessageActions"];
  renderToolActions?: ChatContainerProps["renderToolActions"];
}

export interface SandboxWorkbenchLayoutOptions
  extends Pick<
    WorkspaceLayoutProps,
    | "bottomHeader"
    | "defaultBottomOpen"
    | "defaultLeftOpen"
    | "defaultLeftWidth"
    | "defaultRightOpen"
    | "defaultRightWidth"
    | "density"
    | "keyboardShortcuts"
    | "leftCollapsedControl"
    | "leftOpen"
    | "maxLeftWidth"
    | "maxRightWidth"
    | "minLeftWidth"
    | "minRightWidth"
    | "onLeftOpenChange"
    | "onRightOpenChange"
    | "persistenceKey"
    | "resizable"
    | "rightOpen"
    | "theme"
  > {
  directoryPlacement?: SandboxWorkbenchPlacement;
  artifactPlacement?: SandboxWorkbenchPlacement;
  runtimePlacement?: SandboxWorkbenchPlacement;
}

export interface SandboxWorkbenchProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  /**
   * Optional header above the transcript. By default, `title`, `subtitle`,
   * and `status` live in the transcript pane's own header, with no separate
   * shell row. A node adds a distinct shell header. `null` removes the pane
   * frame too and renders the transcript directly on `bg-background`.
   */
  centerHeader?: ReactNode | null;
  /**
   * Composer rendered under the transcript in the same centered column as
   * `session.composerControls`.
   */
  composer?: ReactNode;
  /**
   * First section of the left region, ahead of the directory pane — a
   * `SessionSidebar` for a chats rail. A rail that is the only left section
   * fills the pane: no region header, no gutter. Give it `fill` and
   * `className="border-r-0"` so the layout's own divider is the only one.
   */
  rail?: ReactNode;
  directory?: DirectoryPaneProps;
  session: SandboxWorkbenchSessionProps;
  artifacts?: SandboxWorkbenchArtifact[];
  activeArtifactId?: string;
  onArtifactChange?: (artifactId: string) => void;
  onArtifactClose?: (artifactId: string) => void;
  runtime?: RuntimePaneProps;
  layout?: SandboxWorkbenchLayoutOptions;
  /**
   * Shown in the artifact region while no artifact is selected. When given,
   * the region renders before the first artifact exists.
   */
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

// A stable partition: pinned tabs first, each side in the order given.
function sortPinnedFirst(artifacts: SandboxWorkbenchArtifact[]) {
  if (!artifacts.some((artifact) => artifact.pinned)) return artifacts;
  return [
    ...artifacts.filter((artifact) => artifact.pinned),
    ...artifacts.filter((artifact) => !artifact.pinned),
  ];
}

function ArtifactTabs({
  artifacts,
  activeArtifactId,
  onSelect,
  onClose,
  tabIdPrefix,
  panelId,
}: {
  artifacts: SandboxWorkbenchArtifact[];
  activeArtifactId?: string;
  onSelect: (artifactId: string) => void;
  onClose?: (artifactId: string) => void;
  tabIdPrefix: string;
  panelId: string;
}) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  if (artifacts.length === 0) return null;

  return (
    <div role="tablist" aria-label="Artifacts" className="flex items-center overflow-x-auto border-b border-border bg-background">
      {artifacts.map((artifact) => {
        const Icon = artifact.icon ?? getArtifactTabIcon(artifact.kind);
        const isActive = artifact.id === activeArtifactId;

        return (
          <div
            key={artifact.id}
            className={cn(
              "group relative flex shrink-0 items-center border-r border-border bg-card",
              isActive
                ? "text-foreground after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "cursor-pointer text-muted-foreground hover:bg-muted",
            )}
          >
            <button
              type="button"
              ref={(element) => {
                if (element) tabRefs.current.set(artifact.id, element);
                else tabRefs.current.delete(artifact.id);
              }}
              id={`${tabIdPrefix}-${artifact.id}`}
              role="tab"
              aria-controls={panelId}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(artifact.id)}
              onKeyDown={(event) => {
                const index = artifacts.findIndex((entry) => entry.id === artifact.id);
                let nextIndex: number;
                switch (event.key) {
                  case "ArrowRight": nextIndex = (index + 1) % artifacts.length; break;
                  case "ArrowLeft": nextIndex = (index - 1 + artifacts.length) % artifacts.length; break;
                  case "Home": nextIndex = 0; break;
                  case "End": nextIndex = artifacts.length - 1; break;
                  default: return;
                }
                event.preventDefault();
                const next = artifacts[nextIndex];
                onSelect(next.id);
                tabRefs.current.get(next.id)?.focus();
              }}
              className={`flex min-w-0 items-center gap-2 px-3 py-2 text-[12px] uppercase tracking-wider font-medium transition-colors hover:text-foreground ${focusRingInset}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[14rem] truncate">{artifactTabLabel(artifact)}</span>
            </button>
            {onClose && !artifact.pinned && (
              <button
                type="button"
                aria-label={`Close ${artifactTabLabel(artifact)}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onClose(artifact.id)}
                className={`mr-1 rounded-[2px] p-1 opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 ${focusRing}`}
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

interface WorkbenchRegionSection {
  key: "rail" | "directory" | "artifacts" | "runtime";
  content: ReactNode;
}

function regionHeader(
  sections: WorkbenchRegionSection[],
  fallback: ReactNode,
) {
  if (sections.length !== 1) {
    return fallback;
  }

  switch (sections[0]?.key) {
    // The rail brings its own header row.
    case "rail":
      return undefined;
    case "directory":
      return (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <FolderTree className="h-3.5 w-3.5" />
          Directory
        </div>
      );
    case "artifacts":
      return (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <LayoutPanelTop className="h-3.5 w-3.5" />
          Artifacts
        </div>
      );
    case "runtime":
      return (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          Runtime
        </div>
      );
    default:
      return fallback;
  }
}

function renderRegion(
  sections: WorkbenchRegionSection[],
  region: SandboxWorkbenchRegion,
) {
  if (sections.length === 0) return undefined;
  if (sections.length === 1) return sections[0]?.content;

  return (
    <div
      className={cn(
        "flex min-h-0 h-full gap-3 p-3",
        region === "bottom" ? "flex-col" : "flex-col",
      )}
    >
      {sections.map((section) => (
        <div key={section.key} className="min-h-0 flex-1 overflow-hidden">
          {section.content}
        </div>
      ))}
    </div>
  );
}

/**
 * SandboxWorkbench — high-level composition that turns sandbox-ui primitives
 * into a complete session surface: directory, agent timeline, artifacts, and
 * runtime in one reusable shell.
 */
export function SandboxWorkbench({
  title,
  subtitle,
  status,
  centerHeader: centerHeaderProp,
  composer,
  rail,
  directory,
  session,
  artifacts: artifactsProp = [],
  activeArtifactId,
  onArtifactChange,
  onArtifactClose,
  runtime,
  layout,
  emptyArtifactState,
  className,
}: SandboxWorkbenchProps) {
  const artifacts = useMemo(() => sortPinnedFirst(artifactsProp), [artifactsProp]);
  const artifactTabsId = useId();
  const artifactPanelId = `${artifactTabsId}-panel`;
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

  // `null` is the quiet look: no pane frame around the transcript.
  const quiet = centerHeaderProp === null;
  const centerHeader = centerHeaderProp ?? undefined;

  const { composerControls, ...chatSession } = session;
  const transcript = (
    <div className={cn("flex h-full min-h-0 flex-col", quiet && "bg-background")}>
      <ChatContainer
        {...chatSession}
        className="min-h-0 flex-1"
        presentation={session.presentation ?? "timeline"}
      />
      {(composerControls || composer) && (
        <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2 px-3 py-3">
          {composerControls}
          {composer}
        </div>
      )}
    </div>
  );
  const paneSubtitle = subtitle ?? session.subtitle;
  const center = quiet ? transcript : (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <WorkspacePaneHeader className="gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {session.eyebrow && (
              <span className="max-w-[35%] shrink-0 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {session.eyebrow}
              </span>
            )}
            <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {title ?? session.title ?? "Execution timeline"}
            </div>
          </div>
          {(paneSubtitle || session.meta || status) && (
            <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted-foreground">
              {paneSubtitle && <span className="min-w-0 truncate">{paneSubtitle}</span>}
              {session.meta && <span className="min-w-0 truncate">{session.meta}</span>}
              {status && <span className="shrink-0">{status}</span>}
            </div>
          )}
        </div>
        {session.headerActions && <div className="flex shrink-0 items-center gap-1.5">{session.headerActions}</div>}
      </WorkspacePaneHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-background">{transcript}</div>
    </section>
  );

  // An empty-state element keeps the artifact region on screen before the
  // first artifact exists, so a consumer can park a directory or a hint there.
  const artifactPanel = artifacts.length > 0 || emptyArtifactState ? (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <ArtifactTabs
        artifacts={artifacts}
        activeArtifactId={resolvedArtifactId}
        onSelect={handleArtifactChange}
        onClose={onArtifactClose}
        tabIdPrefix={artifactTabsId}
        panelId={artifactPanelId}
      />
      <div
        id={artifactPanelId}
        role="tabpanel"
        aria-labelledby={activeArtifact ? `${artifactTabsId}-${activeArtifact.id}` : undefined}
        aria-label={activeArtifact ? undefined : "Artifact content"}
        tabIndex={0}
        className={`min-h-0 flex-1 overflow-auto bg-background ${focusRingInset}`}
      >
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

  const directoryPlacement = layout?.directoryPlacement ?? (directory ? "left" : "hidden");
  const artifactPlacement = layout?.artifactPlacement ?? (artifactPanel ? "right" : "hidden");
  const runtimePlacement = layout?.runtimePlacement ?? (runtime ? "bottom" : "hidden");

  const regionSections: Record<SandboxWorkbenchRegion, WorkbenchRegionSection[]> = {
    left: [],
    right: [],
    bottom: [],
  };

  if (rail) {
    regionSections.left.push({ key: "rail", content: rail });
  }

  if (directory && directoryPlacement !== "hidden") {
    regionSections[directoryPlacement].push({
      key: "directory",
      content: <DirectoryPane {...directory} className="h-full" />,
    });
  }

  if (artifactPanel && artifactPlacement !== "hidden") {
    regionSections[artifactPlacement].push({
      key: "artifacts",
      content: artifactPanel,
    });
  }

  if (runtime && runtimePlacement !== "hidden") {
    regionSections[runtimePlacement].push({
      key: "runtime",
      content: <RuntimePane {...runtime} className="h-full" />,
    });
  }

  const left = renderRegion(regionSections.left, "left");
  const right = renderRegion(regionSections.right, "right");
  const bottom = renderRegion(regionSections.bottom, "bottom");
  const railOnly = regionSections.left.length === 1 && regionSections.left[0]?.key === "rail";

  const genericPanelsHeader = (
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      Workspace Panels
    </span>
  );

  return (
    <WorkspaceLayout
      left={left}
      leftHeader={left ? regionHeader(regionSections.left, genericPanelsHeader) : undefined}
      center={center}
      centerHeader={centerHeader}
      right={right}
      rightHeader={right ? regionHeader(regionSections.right, genericPanelsHeader) : undefined}
      bottom={bottom}
      bottomHeader={bottom ? regionHeader(regionSections.bottom, genericPanelsHeader) : undefined}
      theme={layout?.theme}
      density={layout?.density ?? "comfortable"}
      persistenceKey={layout?.persistenceKey}
      defaultLeftOpen={layout?.defaultLeftOpen ?? Boolean(left)}
      defaultRightOpen={layout?.defaultRightOpen ?? Boolean(right)}
      defaultBottomOpen={layout?.defaultBottomOpen ?? Boolean(bottom)}
      defaultLeftWidth={layout?.defaultLeftWidth}
      defaultRightWidth={layout?.defaultRightWidth}
      minLeftWidth={layout?.minLeftWidth}
      maxLeftWidth={layout?.maxLeftWidth}
      minRightWidth={layout?.minRightWidth}
      maxRightWidth={layout?.maxRightWidth}
      resizable={layout?.resizable}
      leftOpen={layout?.leftOpen}
      onLeftOpenChange={layout?.onLeftOpenChange}
      rightOpen={layout?.rightOpen}
      onRightOpenChange={layout?.onRightOpenChange}
      keyboardShortcuts={layout?.keyboardShortcuts}
      leftCollapsedControl={layout?.leftCollapsedControl}
      leftContentClassName={railOnly ? "py-0" : undefined}
      centerHeaderVisibility="auto"
      className={cn("p-2", className)}
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
            <Bot className="h-4 w-4 text-primary" />
            Execution timeline
          </span>
        ),
      }}
    />
  );
}
