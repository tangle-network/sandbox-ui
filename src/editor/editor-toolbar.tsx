"use client";

import { type Editor } from "@tiptap/react";
import { cn } from "../lib/utils";

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
        "flex items-center gap-1 border-border border-b bg-[var(--depth-2)] p-2",
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
