import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import {
  AgentComposer,
  type AgentComposerMention,
  type MentionItem,
} from "./agent-composer";
import {
  buildComposerStarterKit,
  buildMentionExtension,
} from "./mention-editor";
import { serializeMentionDoc } from "./mention-serialize";

const FILES: MentionItem[] = [
  { id: "src/app.tsx", label: "app.tsx", detail: "src/app.tsx", kind: "file" },
  { id: "src/util.ts", label: "util.ts", detail: "src/util.ts", kind: "file" },
];

function mentionProp(
  overrides: Partial<AgentComposerMention> = {},
): AgentComposerMention {
  return {
    fetchItems: vi.fn(async () => FILES),
    ...overrides,
  };
}

/** Renders a controlled composer with the mention path and waits for the
 * lazily-loaded editor to mount. Returns the contenteditable element. */
async function renderMentionComposer(
  props: Partial<Parameters<typeof AgentComposer>[0]> = {},
) {
  const onSubmit = vi.fn();
  const Wrapper = () => {
    const [value, setValue] = useState((props.value as string) ?? "");
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        mention={mentionProp()}
        controls={null}
        {...props}
      />
    );
  };
  const utils = render(<Wrapper />);
  const editor = await waitFor(() => {
    const node = utils.container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (!node) throw new Error("editor not mounted");
    return node;
  });
  return { ...utils, editor, onSubmit };
}

describe("AgentComposer — mention path", () => {
  it("lazily mounts the rich editor when the mention prop is set", async () => {
    const { editor } = await renderMentionComposer();
    expect(editor).toHaveAttribute("aria-label", "Message input");
  });

  it("Enter submits when the popover is closed", async () => {
    const { editor, onSubmit } = await renderMentionComposer({
      value: "hello",
    });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter does not submit", async () => {
    const { editor, onSubmit } = await renderMentionComposer({
      value: "hello",
    });
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit while an IME composition is active", async () => {
    const { editor, onSubmit } = await renderMentionComposer({
      value: "こんにちは",
    });
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("routes a clipboard file paste to onAttach", async () => {
    const onAttach = vi.fn();
    const { editor } = await renderMentionComposer({ onAttach });
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(4)], "image.png", { type: "image/png" }));
    fireEvent.paste(editor, { clipboardData: dt });

    expect(onAttach).toHaveBeenCalledTimes(1);
    const files = onAttach.mock.calls[0][0] as FileList;
    expect(files[0]?.name).toBe("pasted-image-1.png");
  });

  it("opens the popover and queries fetchItems when the trigger is typed", async () => {
    const fetchItems = vi.fn(async () => FILES);
    const user = userEvent.setup();
    const { editor } = await renderMentionComposer({
      mention: mentionProp({ fetchItems }),
    });
    editor.focus();
    await user.type(editor, "@a");

    await waitFor(() =>
      expect(fetchItems).toHaveBeenCalledWith(expect.stringContaining("a")),
    );
    expect(await screen.findByTestId("mention-popover")).toBeInTheDocument();
  });

  it("threads mention.popoverClassName onto the suggestion popover", async () => {
    const user = userEvent.setup();
    const { editor } = await renderMentionComposer({
      mention: mentionProp({ popoverClassName: "border-primary/40" }),
    });
    editor.focus();
    await user.type(editor, "@a");

    const popover = await screen.findByRole("listbox");
    expect(popover).toHaveClass("border-primary/40");
  });

  it("Enter selects the highlighted item and never submits while open", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onMentionsChange = vi.fn();
    let latest = "";
    const Wrapper = () => {
      const [value, setValue] = useState("");
      latest = value;
      return (
        <AgentComposer
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
          mention={mentionProp({ onMentionsChange })}
          controls={null}
        />
      );
    };
    const { container } = render(<Wrapper />);
    const editor = await waitFor(() => {
      const node = container.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      );
      if (!node) throw new Error("editor not mounted");
      return node;
    });

    editor.focus();
    await user.type(editor, "@a");
    await screen.findAllByRole("option");

    await user.keyboard("{Enter}");

    // The pill was inserted, the message was not sent.
    await waitFor(() => expect(latest).toContain("@src/app.tsx"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onMentionsChange).toHaveBeenLastCalledWith([
      { id: "src/app.tsx", label: "app.tsx", kind: "file" },
    ]);

    // Popover closed after selection; a following Enter now submits.
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("fires onMentionsChange for a programmatic value restore, and guards against a duplicate fire", async () => {
    const user = userEvent.setup();
    const onMentionsChange = vi.fn();
    const fetchItems = vi.fn(async () => FILES);
    let setValueExternal: (value: string) => void = () => {};
    const Wrapper = () => {
      const [value, setValue] = useState("");
      setValueExternal = setValue;
      return (
        <AgentComposer
          value={value}
          onChange={setValue}
          onSubmit={() => {}}
          mention={mentionProp({ onMentionsChange, fetchItems })}
          controls={null}
        />
      );
    };
    const { container } = render(<Wrapper />);
    const editor = await waitFor(() => {
      const node = container.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      );
      if (!node) throw new Error("editor not mounted");
      return node;
    });

    // Open the popover so `knownRef` learns "src/app.tsx" from the fetch
    // response, then back out without inserting — no mention has been
    // reported to `onMentionsChange` yet.
    editor.focus();
    await user.type(editor, "@a");
    await waitFor(() => expect(fetchItems).toHaveBeenCalled());
    await screen.findAllByRole("option");
    await user.keyboard("{Escape}");
    onMentionsChange.mockClear();

    // A programmatic restore (set from outside, not typed) containing the
    // now-known id must still surface it.
    act(() => setValueExternal("intro @src/app.tsx outro"));
    await waitFor(() =>
      expect(onMentionsChange).toHaveBeenCalledWith([
        { id: "src/app.tsx", label: "app.tsx", kind: "file" },
      ]),
    );
    expect(onMentionsChange).toHaveBeenCalledTimes(1);

    // A second restore carrying the same mention set (different surrounding
    // text) must not re-fire the callback.
    act(() => setValueExternal("other @src/app.tsx wrapper"));
    await waitFor(() => expect(editor.textContent).toContain("wrapper"));
    expect(onMentionsChange).toHaveBeenCalledTimes(1);
  });
});

describe("mention node", () => {
  it("is an inline atom so the cursor can't enter it and one backspace clears it", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        buildComposerStarterKit(),
        buildMentionExtension("@", {
          char: "@",
          items: () => [],
          render: () => ({}),
        }),
      ],
    });
    const node = editor.schema.nodes.mention!;
    // atom + non-selectable: ProseMirror treats it as one indivisible unit.
    expect(node.isAtom).toBe(true);
    expect(node.isInline).toBe(true);
    expect(node.spec.selectable).toBe(false);
    editor.destroy();
  });

  it("serializes an inserted mention node as @<id> with a full-id title", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        buildComposerStarterKit(),
        buildMentionExtension("@", {
          char: "@",
          items: () => [],
          render: () => ({}),
        }),
      ],
    });
    editor.commands.insertContent({
      type: "mention",
      attrs: { id: "src/app.tsx", label: "app.tsx", kind: "file" },
    });
    expect(serializeMentionDoc(editor.getJSON())).toContain("@src/app.tsx");
    expect(editor.getHTML()).toContain('title="src/app.tsx"');
    editor.destroy();
  });
});
