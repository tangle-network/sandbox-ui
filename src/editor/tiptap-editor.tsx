"use client";

import type { AnyExtension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { cn } from "../lib/utils";
import { type Collaborator, useEditorContext } from "./editor-provider";

/**
 * Props for TiptapEditor component.
 */
export interface TiptapEditorProps {
  /** Initial content for new documents (markdown string) */
  initialContent?: string;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Custom className for the editor wrapper */
  className?: string;
  /** Custom className for the editor content area */
  contentClassName?: string;
  /** Callback when content changes */
  onUpdate?: (editor: Editor) => void;
  /** Callback when selection changes */
  onSelectionUpdate?: (editor: Editor) => void;
  /** Callback when editor is ready */
  onReady?: (editor: Editor) => void;
}

/**
 * Cursor colors with contrasting text.
 */
const cursorColors: Record<string, { background: string; text: string }> = {
  "#FF6B6B": { background: "#FF6B6B", text: "#FFFFFF" },
  "#4ECDC4": { background: "#4ECDC4", text: "#000000" },
  "#45B7D1": { background: "#45B7D1", text: "#000000" },
  "#96CEB4": { background: "#96CEB4", text: "#000000" },
  "#FFEAA7": { background: "#FFEAA7", text: "#000000" },
  "#DDA0DD": { background: "#DDA0DD", text: "#000000" },
  "#98D8C8": { background: "#98D8C8", text: "#000000" },
  "#F7DC6F": { background: "#F7DC6F", text: "#000000" },
  "#BB8FCE": { background: "#BB8FCE", text: "#000000" },
  "#85C1E9": { background: "#85C1E9", text: "#000000" },
};

/**
 * Get cursor label colors based on user color.
 */
function getCursorColors(color: string) {
  return cursorColors[color] ?? { background: color, text: "#FFFFFF" };
}

/**
 * TiptapEditor - Collaborative markdown editor with Y.js sync.
 * Must be used within an EditorProvider.
 */
export function TiptapEditor({
  initialContent,
  placeholder = "Start writing...",
  readOnly = false,
  autoFocus = false,
  className,
  contentClassName,
  onUpdate,
  onSelectionUpdate,
  onReady,
}: TiptapEditorProps) {
  const { doc, provider, connectionState } = useEditorContext();

  // Y.js fragment for the editor content
  const fragment = useMemo(() => doc.getXmlFragment("prosemirror"), [doc]);

  // Configure Tiptap extensions
  const extensions = useMemo(() => {
    const baseExtensions: AnyExtension[] = [
      StarterKit.configure({
        // Disable history - Y.js handles undo/redo
        ...({ history: false } as any),
        // Configure code block for syntax highlighting placeholder
        codeBlock: {
          HTMLAttributes: {
            class: "hljs",
          },
        },
      }),
      Collaboration.configure({
        fragment,
      }),
    ];

    // Add collaboration cursor if provider is available
    if (provider?.awareness) {
      baseExtensions.push(
        CollaborationCaret.configure({
          provider,
          user: provider.awareness.getLocalState()?.user ?? {
            name: "Anonymous",
            color: "#808080",
          },
          render: (user: { name: string; color: string }) => {
            const { background, text } = getCursorColors(user.color);

            const cursor = document.createElement("span");
            cursor.className = "collaboration-cursor";
            cursor.style.borderColor = background;

            const label = document.createElement("span");
            label.className = "collaboration-cursor-label";
            label.style.backgroundColor = background;
            label.style.color = text;
            label.textContent = user.name;

            cursor.appendChild(label);
            return cursor;
          },
        }),
      );
    }

    return baseExtensions;
  }, [fragment, provider]);

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions,
    editable: !readOnly,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none",
          "focus:outline-none",
          contentClassName,
        ),
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      onSelectionUpdate?.(ed);
    },
    onCreate: ({ editor: ed }) => {
      onReady?.(ed);
    },
  });

  // Update editable state when readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Handle initial content (only for new documents)
  useEffect(() => {
    if (
      editor &&
      initialContent &&
      connectionState === "synced" &&
      editor.isEmpty
    ) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent, connectionState]);

  return (
    <div
      className={cn(
        "relative min-h-[200px] w-full rounded-lg border border-border",
        "bg-background",
        className,
      )}
    >
      {/* Connection status indicator */}
      <div className="absolute top-2 right-2 z-10">
        <ConnectionIndicator state={connectionState} />
      </div>

      {/* Editor content */}
      <div className="p-4 pt-10">
        <EditorContent editor={editor} />
      </div>

      {/* Placeholder when empty */}
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground, #999);
          pointer-events: none;
          height: 0;
        }

        .collaboration-cursor {
          position: relative;
          border-left: 2px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          word-break: normal;
        }

        .collaboration-cursor-label {
          position: absolute;
          top: -1.4em;
          left: -1px;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          line-height: normal;
          padding: 2px 6px;
          border-radius: 4px 4px 4px 0;
          white-space: nowrap;
          user-select: none;
        }

        .ProseMirror pre {
          background: var(--muted, #f4f4f5);
          border-radius: 0.375rem;
          padding: 0.75rem 1rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.875rem;
          overflow-x: auto;
        }

        .dark .ProseMirror pre {
          background: var(--muted, #27272a);
        }

        .ProseMirror code {
          background: var(--muted, #f4f4f5);
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.875em;
        }

        .dark .ProseMirror code {
          background: var(--muted, #27272a);
        }

        .ProseMirror pre code {
          background: transparent;
          padding: 0;
          font-size: inherit;
        }
      `}</style>
    </div>
  );
}

/**
 * Connection status indicator component.
 */
function ConnectionIndicator({
  state,
}: {
  state: "disconnected" | "connecting" | "connected" | "synced";
}) {
  const config = {
    disconnected: {
      color: "bg-red-500",
      label: "Disconnected",
    },
    connecting: {
      color: "bg-yellow-500 animate-pulse",
      label: "Connecting...",
    },
    connected: {
      color: "bg-blue-500",
      label: "Connected",
    },
    synced: {
      color: "bg-green-500",
      label: "Synced",
    },
  }[state];

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <span className={cn("h-2 w-2 rounded-full", config.color)} />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * Collaborators list component.
 * Shows active users in the document.
 */
export function CollaboratorsList({
  collaborators,
  className,
}: {
  collaborators: Collaborator[];
  className?: string;
}) {
  if (collaborators.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {collaborators.slice(0, 5).map((collab) => (
        <div
          key={collab.clientId}
          className="flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs"
          style={{ backgroundColor: collab.user.color }}
          title={collab.user.name}
        >
          {collab.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {collaborators.length > 5 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-medium text-xs">
          +{collaborators.length - 5}
        </div>
      )}
    </div>
  );
}

/**
 * Editor toolbar component.
 * Provides basic formatting controls.
 */
export function EditorToolbar({
  editor,
  className,
}: {
  editor: Editor | null;
  className?: string;
}) {
  if (!editor) {
    return null;
  }

  const buttons = [
    {
      id: "bold",
      label: "Bold",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
      shortcut: "Ctrl+B",
    },
    {
      id: "italic",
      label: "Italic",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
      shortcut: "Ctrl+I",
    },
    {
      id: "strike",
      label: "Strike",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive("strike"),
      shortcut: "Ctrl+Shift+X",
    },
    {
      id: "code",
      label: "Code",
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive("code"),
      shortcut: "Ctrl+E",
    },
    { id: "sep-1", type: "separator" as const },
    {
      id: "h1",
      label: "H1",
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive("heading", { level: 1 }),
    },
    {
      id: "h2",
      label: "H2",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive("heading", { level: 2 }),
    },
    {
      id: "h3",
      label: "H3",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive("heading", { level: 3 }),
    },
    { id: "sep-2", type: "separator" as const },
    {
      id: "bullet-list",
      label: "Bullet List",
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList"),
    },
    {
      id: "ordered-list",
      label: "Ordered List",
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList"),
    },
    {
      id: "code-block",
      label: "Code Block",
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive("codeBlock"),
    },
    {
      id: "blockquote",
      label: "Blockquote",
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive("blockquote"),
    },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-1 border-border border-b bg-muted/50 p-2",
        className,
      )}
    >
      {buttons.map((button) => {
        if ("type" in button && button.type === "separator") {
          return <div key={button.id} className="mx-1 h-6 w-px bg-border" />;
        }

        return (
          <button
            key={button.id}
            onClick={button.action}
            type="button"
            title={
              "shortcut" in button
                ? `${button.label} (${button.shortcut})`
                : button.label
            }
            className={cn(
              "rounded px-2 py-1 font-medium text-xs transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              button.isActive && "bg-accent text-accent-foreground",
            )}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
