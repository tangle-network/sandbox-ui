import { mergeAttributes } from "@tiptap/core";
import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion } from "@tiptap/suggestion";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import * as React from "react";
import { cn } from "../lib/utils";
import type { AgentComposerMention, MentionItem } from "./agent-composer";
import { MentionList, type MentionListHandle } from "./mention-list";
import {
  collectMentions,
  parseMentionValue,
  serializeMentionDoc,
  type MentionDocNode,
} from "./mention-serialize";

export interface MentionEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when Enter (no Shift, popover closed, not composing) should send. */
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  minRows: number;
  maxHeight: number;
  mention: AgentComposerMention;
  /** Registers a focus callback the composer wires to Cmd/Ctrl+L. */
  registerFocus?: (focus: () => void) => void;
  /**
   * Clipboard files pulled off a paste. Returns true when consumed so the
   * editor suppresses its default text paste — the same funnel the textarea
   * path routes through to `onAttach`.
   */
  onPasteFiles?: (files: FileList) => boolean;
}

/** Only text, hard breaks, and atomic mention pills — no marks, no formatting. */
export function buildComposerStarterKit() {
  return StarterKit.configure({
    blockquote: false,
    bold: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    italic: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    underline: false,
  });
}

const MENTION_PILL_CLASS = cn(
  "rounded-md bg-primary/10 px-1 py-0.5 font-medium text-primary",
);

/**
 * The mention node: an inline atom (`inline: true, selectable: false,
 * atom: true` from `@tiptap/extension-mention`) carrying `{ id, label, kind }`,
 * rendered as a themed pill showing the label with the full id in `title`. Atom
 * means the cursor can't enter it and a single backspace removes the whole
 * thing. The `suggestion` config is supplied by the caller so the popover's
 * fetch/keyboard wiring stays in the component.
 */
export function buildMentionExtension(
  trigger: string,
  suggestion: MentionOptions["suggestion"],
) {
  return Mention.extend({
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-id"),
          renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
        },
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-label"),
          renderHTML: (attrs) =>
            attrs.label ? { "data-label": attrs.label } : {},
        },
        kind: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-kind"),
          renderHTML: (attrs) => (attrs.kind ? { "data-kind": attrs.kind } : {}),
        },
      };
    },
  }).configure({
    HTMLAttributes: { class: MENTION_PILL_CLASS },
    renderText: ({ node }) => `${trigger}${node.attrs.id}`,
    renderHTML: ({ options, node }) => [
      "span",
      mergeAttributes(options.HTMLAttributes, {
        title: node.attrs.id ?? undefined,
      }),
      `${trigger}${node.attrs.label ?? node.attrs.id}`,
    ],
    suggestion,
  });
}

const EDITOR_CLASS = cn(
  "w-full whitespace-pre-wrap break-words bg-transparent px-2 py-1",
  "text-foreground text-sm leading-relaxed outline-none",
);

/**
 * The mention-capable rich input. Loaded lazily by `AgentComposer` so
 * textarea-only consumers never pull TipTap into their initial bundle. It
 * preserves every textarea behavior — controlled plain-text `value`, Enter to
 * send / Shift+Enter for a newline, autosize, placeholder, disabled, autofocus,
 * file-paste routing — and adds `@`-mention pills backed by an async provider.
 */
export default function MentionEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  autoFocus,
  minRows,
  maxHeight,
  mention,
  registerFocus,
  onPasteFiles,
}: MentionEditorProps) {
  const trigger = mention.trigger ?? "@";

  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<MentionItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  // Live refs keep the once-built editor's callbacks reading current props and
  // state without rebuilding the editor (which would drop cursor + content).
  const openRef = React.useRef(false);
  const commandRef = React.useRef<((item: MentionItem) => void) | null>(null);
  const listRef = React.useRef<MentionListHandle | null>(null);
  const knownRef = React.useRef<Map<string, MentionItem>>(new Map());
  const requestIdRef = React.useRef(0);
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onMentionsChangeRef = React.useRef(mention.onMentionsChange);
  onMentionsChangeRef.current = mention.onMentionsChange;
  const onPasteFilesRef = React.useRef(onPasteFiles);
  onPasteFilesRef.current = onPasteFiles;
  const fetchItemsRef = React.useRef(mention.fetchItems);
  fetchItemsRef.current = mention.fetchItems;

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !disabled,
      autofocus: autoFocus ? "end" : false,
      content: parseMentionValue(value, knownRef.current),
      editorProps: {
        attributes: {
          class: EDITOR_CLASS,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Message input",
        },
        handleKeyDown: (_view, event) => {
          if (event.key !== "Enter" || event.shiftKey) return false;
          // Composition (IME) commits via Enter — never send mid-composition.
          if (event.isComposing || event.keyCode === 229) return false;
          // Popover open ⇒ Enter belongs to the suggestion plugin (selects).
          if (openRef.current) return false;
          event.preventDefault();
          onSubmitRef.current();
          return true;
        },
        handlePaste: (_view, event) => {
          const files = event.clipboardData?.files;
          if (files && files.length > 0 && onPasteFilesRef.current) {
            return onPasteFilesRef.current(files);
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON() as MentionDocNode;
        onChangeRef.current(serializeMentionDoc(json));
        const mentions = collectMentions(json);
        for (const item of mentions) knownRef.current.set(item.id, item);
        onMentionsChangeRef.current?.(mentions);
      },
      extensions: [
        buildComposerStarterKit(),
        buildMentionExtension(trigger, {
          char: trigger,
          allowSpaces: false,
          // Items are fetched by this component (so it can model loading and
          // error states), not by the suggestion plugin.
          items: () => [],
          command: ({ editor, range, props }) => {
            const item = props as unknown as MentionItem;
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: "mention",
                  attrs: {
                    id: item.id,
                    label: item.label,
                    kind: item.kind ?? null,
                  },
                },
                { type: "text", text: " " },
              ])
              .run();
            knownRef.current.set(item.id, item);
          },
          render: () => ({
            onStart: (props: SuggestionProps) => {
              openRef.current = true;
              commandRef.current = props.command;
              setOpen(true);
              setQuery(props.query);
              setAnchor(props.clientRect?.() ?? null);
            },
            onUpdate: (props: SuggestionProps) => {
              commandRef.current = props.command;
              setQuery(props.query);
              setAnchor(props.clientRect?.() ?? null);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                exitSuggestion(props.view);
                return true;
              }
              return listRef.current?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              openRef.current = false;
              commandRef.current = null;
              setOpen(false);
              setItems([]);
              setLoading(false);
              setErrored(false);
            },
          }),
        }),
      ],
    },
    [],
  );

  // Fetch matches for the active query; a monotonic id drops stale responses.
  React.useEffect(() => {
    if (!open) return;
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setErrored(false);
    Promise.resolve(fetchItemsRef.current(query))
      .then((results) => {
        if (requestId !== requestIdRef.current) return;
        for (const item of results) knownRef.current.set(item.id, item);
        setItems(results);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setErrored(true);
        setLoading(false);
      });
  }, [open, query]);

  // Programmatic `value` changes (queued-turn restore, retry refill) re-parse
  // into the document; known `@<id>` runs come back as pills. Guarded against
  // the onChange→value feedback loop by comparing the serialized form.
  React.useEffect(() => {
    if (!editor) return;
    if (serializeMentionDoc(editor.getJSON() as MentionDocNode) === value) return;
    editor.commands.setContent(parseMentionValue(value, knownRef.current), {
      emitUpdate: false,
    });
  }, [editor, value]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  React.useEffect(() => {
    if (!editor || !registerFocus) return;
    registerFocus(() => editor.commands.focus());
  }, [editor, registerFocus]);

  return (
    <div className="relative">
      <div
        className="overflow-y-auto"
        style={{ maxHeight, minHeight: `${minRows * 1.5}rem` }}
      >
        <EditorContent editor={editor} />
        {value.length === 0 && (
          <div className="pointer-events-none absolute top-1 left-2 text-muted-foreground text-sm leading-relaxed">
            {placeholder}
          </div>
        )}
      </div>

      {open && (
        <div
          className="absolute z-20"
          style={anchorStyle(anchor)}
          data-testid="mention-popover"
        >
          <MentionList
            ref={listRef}
            items={items}
            loading={loading}
            error={errored}
            emptyText={mention.emptyText}
            renderItem={mention.renderItem}
            onSelect={(item) => commandRef.current?.(item)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Anchor the popover just below the caret. `getBoundingClientRect` is
 * unavailable under jsdom (returns a zero rect), so a missing anchor falls back
 * to the composer's top-left rather than throwing.
 */
function anchorStyle(rect: DOMRect | null): React.CSSProperties {
  if (!rect || (rect.left === 0 && rect.bottom === 0)) {
    return { position: "absolute", top: "100%", left: 0 };
  }
  return { position: "fixed", top: rect.bottom + 4, left: rect.left };
}
