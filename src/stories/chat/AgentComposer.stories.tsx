import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  AgentComposer,
  AgentProfilePicker,
  type AgentProfileCapability,
  type AgentProfileDraft,
  type AgentProfileOption,
  type ComposerFile,
  DEFAULT_REASONING_LEVEL_OPTIONS,
  type MentionItem,
  ReasoningLevelPicker,
  type ReasoningLevel,
} from "../../chat";

const meta: Meta<typeof AgentComposer> = {
  title: "Chat/AgentComposer",
  component: AgentComposer,
  parameters: { layout: "fullscreen", backgrounds: { default: "dark" } },
  decorators: [
    (Story) => (
      // Docked at the bottom of a tall dark canvas, like a real chat — so the
      // pickers open upward over the transcript space.
      <div className="dark flex min-h-[640px] flex-col justify-end bg-background p-6 text-foreground [color-scheme:dark]">
        <div className="mx-auto w-full max-w-2xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentComposer>;

const PROFILES: AgentProfileOption[] = [
  {
    id: "build",
    name: "Build",
    description: "Full toolset — edit files, run commands, expose ports.",
    builtin: true,
  },
  {
    id: "chat",
    name: "Chat",
    description: "Just talk — no build tools.",
    builtin: true,
  },
  {
    id: "reviewer",
    name: "Tax Reviewer",
    capabilities: ["datasets", "review"],
    instructions: "Audit filings against the latest code; cite every line.",
  },
];

const CAPABILITIES: AgentProfileCapability[] = [
  { id: "datasets", label: "Datasets", description: "Generate and inspect behavioral datasets." },
  { id: "review", label: "Review", description: "Critique and score model output." },
  { id: "training", label: "Training", description: "Fine-tune and evaluate models." },
  { id: "deploy", label: "Deploy", description: "Ship a private model endpoint." },
];

/**
 * The composer's control strip is explicit: the canonical strip is
 * `AgentSessionControls` from `@tangle-network/agent-app/web-react`; these
 * stories compose the standalone pickers this package still ships.
 */
function DemoControls() {
  const [profile, setProfile] = useState("build");
  const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
  return (
    <>
      <AgentProfilePicker
        value={profile}
        onChange={setProfile}
        profiles={PROFILES}
      />
      <ReasoningLevelPicker
        value={reasoning}
        onChange={setReasoning}
        options={DEFAULT_REASONING_LEVEL_OPTIONS}
      />
    </>
  );
}

/** Controls supplied via the `controls` slot: agent profile + effort pickers. */
export const WithAgentControls: Story = {
  name: "Agent controls (profile · effort)",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Analyze the ingestion pipeline and fix the retry logic."
        controls={<DemoControls />}
      />
    );
  },
};

/** A bare composer: `controls={null}` renders no strip at all. */
export const Bare: Story = {
  name: "Bare (no controls)",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask anything…"
        controls={null}
      />
    );
  },
};

/** Attachments + streaming: drag-drop / attach buttons, file chips, Stop button. */
export const WithAttachmentsAndStreaming: Story = {
  name: "Attachments + streaming (Stop)",
  render: () => {
    const [value, setValue] = useState("Summarize the attached spec.");
    const [busy, setBusy] = useState(true);
    const [files, setFiles] = useState<ComposerFile[]>([
      { id: "1", name: "design-spec.pdf", kind: "file", status: "ready" },
      { id: "2", name: "src", kind: "folder", fileCount: 42, status: "ready" },
      { id: "3", name: "upload.csv", kind: "file", status: "uploading" },
    ]);
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        busy={busy}
        onCancel={() => setBusy(false)}
        focusShortcut
        placeholder="Ask, or drop files…"
        onAttach={(fileList) =>
          setFiles((f) => [
            ...f,
            ...Array.from(fileList).map((file, index) => ({
              id: `${f.length + index + 1}`,
              name: file.name,
              kind: "file" as const,
              status: "pending" as const,
            })),
          ])
        }
        onAttachFolder={() => {}}
        attachments={files}
        onRemoveFile={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        controls={<DemoControls />}
      />
    );
  },
};

// A tiny inline SVG data URI stands in for a real object URL from
// `URL.createObjectURL` — no network fetch, works offline in Storybook.
function thumbnailDataUri(fill: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${fill}"/></svg>`,
  )}`;
}

/** Image chips render a thumbnail in place of the paperclip icon. */
export const WithThumbnails: Story = {
  name: "Attachments with thumbnails",
  render: () => {
    const [value, setValue] = useState("");
    const [files, setFiles] = useState<ComposerFile[]>([
      {
        id: "1",
        name: "hero-shot.png",
        kind: "file",
        status: "ready",
        previewUrl: thumbnailDataUri("#5b4ed4"),
      },
      {
        id: "2",
        name: "logo.svg",
        kind: "file",
        status: "ready",
        previewUrl: thumbnailDataUri("#22c55e"),
      },
      { id: "3", name: "notes.txt", kind: "file", status: "pending" },
    ]);
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask about the attached images…"
        onAttach={() => {}}
        attachments={files}
        onRemoveFile={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        controls={null}
      />
    );
  },
};

/** A failed upload chip shows its error and offers a retry action. */
export const WithErrorAndRetry: Story = {
  name: "Attachment error + retry",
  render: () => {
    const [value, setValue] = useState("");
    const [files, setFiles] = useState<ComposerFile[]>([
      { id: "1", name: "design-spec.pdf", kind: "file", status: "ready" },
      {
        id: "2",
        name: "video-4k-master.mov",
        kind: "file",
        status: "error",
        errorMessage: "Upload failed: file exceeds the 25 MB limit.",
      },
    ]);
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask, or drop files…"
        onAttach={() => {}}
        attachments={files}
        onRemoveFile={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        onRetryFile={(id) =>
          setFiles((f) =>
            f.map((file) =>
              file.id === id
                ? { ...file, status: "uploading", errorMessage: undefined }
                : file,
            ),
          )
        }
        controls={null}
      />
    );
  },
};

// A fake workspace file index for the mention popover. `fetchItems` mimics a
// sandbox round-trip: a short delay, then name/path substring filtering.
const MENTION_FILES: MentionItem[] = [
  { id: "src/app.tsx", label: "app.tsx", detail: "src", kind: "file" },
  { id: "src/routes/api.chat.ts", label: "api.chat.ts", detail: "src/routes", kind: "file" },
  { id: "src/lib/utils.ts", label: "utils.ts", detail: "src/lib", kind: "file" },
  { id: "src/chat/agent-composer.tsx", label: "agent-composer.tsx", detail: "src/chat", kind: "file" },
  { id: "package.json", label: "package.json", detail: ".", kind: "file" },
  { id: "README.md", label: "README.md", detail: ".", kind: "file" },
];

async function fakeFetchItems(query: string): Promise<MentionItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const q = query.toLowerCase();
  if (!q) return MENTION_FILES.slice(0, 5);
  return MENTION_FILES.filter(
    (file) =>
      file.label.toLowerCase().includes(q) || file.id.toLowerCase().includes(q),
  );
}

/**
 * Mentions: typing `@` opens a caret-anchored popover backed by an async
 * provider; a selection becomes an atomic pill that serializes to `@<id>`.
 */
export const WithMentions: Story = {
  name: "Mentions (@-file picker)",
  render: () => {
    const [value, setValue] = useState("");
    const [mentioned, setMentioned] = useState<MentionItem[]>([]);
    return (
      <div className="flex flex-col gap-2">
        <AgentComposer
          value={value}
          onChange={setValue}
          onSubmit={() => setValue("")}
          placeholder="Ask about your files — type @ to reference one…"
          mention={{
            fetchItems: fakeFetchItems,
            onMentionsChange: setMentioned,
            emptyText: "No files match",
            // Demonstrates retheming the popover via the supported prop
            // instead of targeting it by its ARIA attributes.
            popoverClassName: "border-primary/40",
          }}
          controls={null}
        />
        <p className="px-1 text-muted-foreground text-xs">
          Referenced: {mentioned.map((m) => m.id).join(", ") || "none"}
        </p>
      </div>
    );
  },
};

/** Profile authoring: a capability catalog + write callbacks enable New/edit. */
export const ProfileAuthoring: Story = {
  name: "Agent authoring in the controls slot",
  render: () => {
    const [value, setValue] = useState("");
    const [profiles, setProfiles] = useState<AgentProfileOption[]>(PROFILES);
    const [profile, setProfile] = useState("build");

    const create = (draft: AgentProfileDraft) => {
      const id = draft.name.toLowerCase().replace(/\s+/g, "-");
      setProfiles((prev) => [...prev, { ...draft, id }]);
      setProfile(id);
    };
    const update = (id: string, draft: AgentProfileDraft) =>
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...draft } : p)));
    const remove = (id: string) =>
      setProfiles((prev) => prev.filter((p) => p.id !== id));

    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask your agent…"
        controls={
          <AgentProfilePicker
            value={profile}
            onChange={setProfile}
            profiles={profiles}
            capabilities={CAPABILITIES}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
          />
        }
      />
    );
  },
};
