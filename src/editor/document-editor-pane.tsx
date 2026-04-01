"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { PencilLine, Save, Users, Wifi, WifiOff } from "lucide-react";
import { Markdown } from "../markdown/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/tabs";
import { cn } from "../lib/utils";
import { ArtifactPane, type ArtifactPaneProps } from "../workspace/artifact-pane";
import {
  CollaboratorsList,
  TiptapEditor,
  type TiptapEditorProps,
} from "./tiptap-editor";
import {
  EditorProvider,
  type ConnectionState,
  type EditorProviderProps,
} from "./editor-provider";
import { MarkdownDocumentEditor } from "./markdown-document-editor";
import {
  htmlToMarkdown,
  markdownToHtml,
  normalizeMarkdown,
} from "./markdown-conversion";
import { useCollaborators, useEditorConnection } from "./use-editor";

export type DocumentEditorMode = "preview" | "edit";
export type DocumentEditorBackend = "local" | "collaborative";

export interface DocumentEditorPaneCollaborationConfig
  extends Omit<EditorProviderProps, "children"> {}

export interface DocumentEditorPaneProps
  extends Omit<ArtifactPaneProps, "children" | "tabs" | "toolbar" | "emptyState"> {
  tabs?: ArtifactPaneProps["tabs"];
  toolbar?: ReactNode;
  markdown?: string;
  mode?: DocumentEditorMode;
  defaultMode?: DocumentEditorMode;
  onModeChange?: (mode: DocumentEditorMode) => void;
  backend?: DocumentEditorBackend;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onChange?: (markdown: string) => void;
  onSave?: (markdown: string) => Promise<void> | void;
  saving?: boolean;
  saveLabel?: string;
  previewClassName?: string;
  editorClassName?: string;
  collaboration?: DocumentEditorPaneCollaborationConfig;
}

function connectionTone(state: ConnectionState) {
  switch (state) {
    case "synced":
      return "text-[var(--surface-success-text)] border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]";
    case "connected":
    case "connecting":
      return "text-[var(--surface-info-text)] border-[var(--surface-info-border)] bg-[var(--surface-info-bg)]";
    case "disconnected":
    default:
      return "text-[var(--surface-warning-text)] border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)]";
  }
}

function connectionLabel(state: ConnectionState) {
  switch (state) {
    case "synced":
      return "Live synced";
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "disconnected":
    default:
      return "Offline";
  }
}

function connectionDescription(
  state: ConnectionState,
  collaborators: number,
  readOnly?: boolean,
) {
  if (readOnly) {
    return state === "disconnected"
      ? "Live access is paused. You can keep reading while the editor reconnects."
      : "You are viewing the live document in read-only mode.";
  }

  switch (state) {
    case "synced":
      return collaborators > 0
        ? `You and ${collaborators} collaborator${
            collaborators === 1 ? "" : "s"
          } are editing the same document.`
        : "You are editing the live document. Changes sync automatically.";
    case "connected":
    case "connecting":
      return "Connecting the live document. Local edits stay in place while sync catches up.";
    case "disconnected":
    default:
      return "Live updates are paused. You can keep editing and reconnect when the transport is healthy again.";
  }
}

function CollaborativeDocumentSurface({
  markdown,
  placeholder,
  autoFocus,
  readOnly,
  className,
  onChange,
}: {
  markdown: string;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  className?: string;
  onChange?: (markdown: string) => void;
}) {
  const { state } = useEditorConnection();
  const { collaborators } = useCollaborators();
  const initialContent = useMemo(() => markdownToHtml(markdown), [markdown]);
  const collaboratorCount = collaborators.length + 1;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border bg-card px-3 py-2">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                connectionTone(state),
              )}
            >
              {state === "disconnected" ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {connectionLabel(state)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--bg-input)] px-2.5 py-1">
              <Users className="h-3.5 w-3.5" />
              {collaborators.length === 0 ? "Solo editing" : `${collaboratorCount} active`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {connectionDescription(state, collaborators.length, readOnly)}
          </p>
        </div>
        <CollaboratorsList collaborators={collaborators} />
      </div>

      <TiptapEditor
        initialContent={initialContent}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className={cn("h-full min-h-[28rem]", className)}
        onUpdate={(editor) => {
          onChange?.(normalizeMarkdown(htmlToMarkdown(editor.getHTML())));
        }}
      />
    </div>
  );
}

/**
 * DocumentEditorPane — reusable markdown document surface with preview/edit
 * modes and optional collaborative editing backed by Yjs/Hocuspocus.
 */
export function DocumentEditorPane({
  eyebrow,
  title,
  subtitle,
  meta,
  headerActions,
  footer,
  className,
  contentClassName,
  tabs,
  toolbar,
  markdown = "",
  mode,
  defaultMode = "preview",
  onModeChange,
  backend = "local",
  placeholder = "Start writing...",
  autoFocus = false,
  readOnly = false,
  onChange,
  onSave,
  saving = false,
  saveLabel = "Save changes",
  previewClassName,
  editorClassName,
  collaboration,
}: DocumentEditorPaneProps) {
  const [draft, setDraft] = useState(markdown);
  const [uncontrolledMode, setUncontrolledMode] =
    useState<DocumentEditorMode>(defaultMode);
  const activeMode = mode ?? uncontrolledMode;
  const isCollaborative = backend === "collaborative" && Boolean(collaboration);
  const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(markdown);
  const saveStateLabel = readOnly
    ? "Read only"
    : isCollaborative
      ? isDirty
        ? "Snapshot pending"
        : "Live document current"
      : isDirty
        ? "Unsaved changes"
        : "Saved";

  useEffect(() => {
    setDraft(markdown);
  }, [markdown]);

  useEffect(() => {
    if (mode === undefined) {
      setUncontrolledMode(defaultMode);
    }
  }, [defaultMode, mode]);

  const setMode = (nextMode: DocumentEditorMode) => {
    if (mode === undefined) {
      setUncontrolledMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  const handleChange = (nextMarkdown: string) => {
    setDraft(nextMarkdown);
    onChange?.(nextMarkdown);
  };

  const editorToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TabsList
        variant="underline"
        className="h-auto gap-4 border-0 bg-transparent p-0 text-muted-foreground"
      >
        <TabsTrigger
          value="preview"
          variant="underline"
          className="pb-2 data-[state=active]:border-primary data-[state=active]:text-foreground"
        >
          Preview
        </TabsTrigger>
        <TabsTrigger
          value="edit"
          variant="underline"
          className="flex items-center gap-2 pb-2 data-[state=active]:border-primary data-[state=active]:text-foreground"
        >
          <PencilLine className="h-3.5 w-3.5" />
          {isCollaborative ? "Live edit" : "Edit"}
        </TabsTrigger>
      </TabsList>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {toolbar}
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">
          {isCollaborative ? "Live document" : "Local draft"}
        </span>
        <span className="rounded-full border border-border bg-[var(--bg-input)] px-2.5 py-1">
          {saveStateLabel}
        </span>
        {onSave && !readOnly && (
          <button
            type="button"
            onClick={() => void onSave(draft)}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : saveLabel}
          </button>
        )}
      </div>
    </div>
  );

  const preview = (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-[var(--bg-input)] p-5",
        previewClassName,
      )}
    >
      <Markdown className="prose-sm max-w-none">{draft}</Markdown>
    </div>
  );

  const localEditor = (
    <MarkdownDocumentEditor
      value={draft}
      placeholder={placeholder}
      autoFocus={autoFocus}
      readOnly={readOnly}
      onChange={(nextMarkdown) => {
        handleChange(nextMarkdown);
      }}
      className={editorClassName}
    />
  );

  const collaborativeEditor = collaboration ? (
    <EditorProvider key={collaboration.documentName} {...collaboration}>
      <CollaborativeDocumentSurface
        markdown={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className={editorClassName}
        onChange={handleChange}
      />
    </EditorProvider>
  ) : localEditor;

  return (
    <Tabs
      value={activeMode}
      onValueChange={(nextValue) => setMode(nextValue as DocumentEditorMode)}
      className="h-full"
    >
      <ArtifactPane
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        meta={meta}
        headerActions={headerActions}
        footer={footer}
        tabs={tabs}
        className={className}
        contentClassName={contentClassName}
        toolbar={editorToolbar}
      >
        <TabsContent value="preview" className="mt-0 h-full px-4 py-4">
          {preview}
        </TabsContent>
        <TabsContent value="edit" className="mt-0 h-full px-4 py-4">
          {isCollaborative ? collaborativeEditor : localEditor}
        </TabsContent>
      </ArtifactPane>
    </Tabs>
  );
}
