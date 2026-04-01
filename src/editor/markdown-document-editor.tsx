"use client";

import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { EditorToolbar } from "./editor-toolbar";
import {
  htmlToMarkdown,
  markdownToHtml,
  normalizeMarkdown,
} from "./markdown-conversion";

export interface MarkdownDocumentEditorProps {
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  contentClassName?: string;
  onChange?: (markdown: string, editor: Editor) => void;
  onReady?: (editor: Editor) => void;
}

export function MarkdownDocumentEditor({
  value = "",
  placeholder = "Start writing...",
  readOnly = false,
  autoFocus = false,
  className,
  contentClassName,
  onChange,
  onReady,
}: MarkdownDocumentEditorProps) {
  const initialHtml = useMemo(() => markdownToHtml(value), []);
  const lastAppliedMarkdownRef = useRef(normalizeMarkdown(value));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "hljs",
          },
        },
      }),
    ],
    content: initialHtml,
    editable: !readOnly,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base max-w-none focus:outline-none",
          "prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)]",
          "prose-strong:text-[var(--text-primary)] prose-code:text-[var(--text-primary)] prose-pre:text-[var(--text-secondary)]",
          contentClassName,
        ),
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextMarkdown = normalizeMarkdown(htmlToMarkdown(currentEditor.getHTML()));
      lastAppliedMarkdownRef.current = nextMarkdown;
      onChange?.(nextMarkdown, currentEditor);
    },
    onCreate: ({ editor: currentEditor }) => {
      onReady?.(currentEditor);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedValue = normalizeMarkdown(value);
    if (normalizedValue === lastAppliedMarkdownRef.current) {
      return;
    }

    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false });
    lastAppliedMarkdownRef.current = normalizedValue;
  }, [editor, value]);

  return (
    <div
      className={cn(
        "flex min-h-[14rem] w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-input)]",
        className,
      )}
    >
      <EditorToolbar
        editor={editor}
        className="border-[var(--border-subtle)] bg-[var(--depth-2)] px-2 py-2"
      />
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted, #999);
          pointer-events: none;
          height: 0;
        }

        .ProseMirror pre {
          background: var(--bg-elevated, #16161a);
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          overflow-x: auto;
        }

        .ProseMirror code {
          background: var(--depth-3);
          border-radius: 0.35rem;
          padding: 0.12rem 0.3rem;
        }

        .ProseMirror pre code {
          background: transparent;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
