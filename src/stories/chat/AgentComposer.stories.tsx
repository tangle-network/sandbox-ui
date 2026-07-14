import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  AgentComposer,
  type AgentProfileCapability,
  type AgentProfileDraft,
  type AgentProfileOption,
  type ComposerFile,
  DEFAULT_REASONING_LEVEL_OPTIONS,
  type ReasoningLevel,
} from "../../chat";
import type { HarnessType, ModelInfo } from "../../dashboard";

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

const MODELS: ModelInfo[] = [
  {
    id: "anthropic/claude-opus-4-8",
    name: "Claude Opus 4.8",
    _provider: "anthropic",
    pricing: { prompt: "0.000015", completion: "0.000075" },
    context_length: 200_000,
    architecture: { modality: "text" },
    featured: true,
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    _provider: "anthropic",
    pricing: { prompt: "0.000003", completion: "0.000015" },
    context_length: 200_000,
    architecture: { modality: "text" },
  },
  {
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    _provider: "openai",
    pricing: { prompt: "0.00001", completion: "0.00003" },
    context_length: 400_000,
    architecture: { modality: "text" },
    featured: true,
  },
  {
    id: "openai/gpt-5.4-codex",
    name: "GPT-5.4 Codex",
    _provider: "openai",
    pricing: { prompt: "0.00001", completion: "0.00003" },
    context_length: 400_000,
    architecture: { modality: "text" },
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    _provider: "google",
    pricing: { prompt: "0.00000125", completion: "0.00001" },
    context_length: 1_000_000,
    architecture: { modality: "text" },
  },
  {
    id: "moonshot/kimi-k2",
    name: "Kimi K2",
    _provider: "moonshot",
    pricing: { prompt: "0.0000006", completion: "0.0000025" },
    context_length: 200_000,
    architecture: { modality: "text" },
  },
];

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

/** Sandbox-backed: harness pill present; harness↔model snap together. */
export const SandboxBacked: Story = {
  name: "Sandbox-backed (harness · model · effort)",
  render: () => {
    const [value, setValue] = useState("");
    const [harness, setHarness] = useState<HarnessType>("claude-code");
    const [model, setModel] = useState("anthropic/claude-opus-4-8");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
    const [profile, setProfile] = useState("build");
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Analyze the ingestion pipeline and fix the retry logic."
        harness={{ value: harness, onChange: setHarness }}
        profile={{ value: profile, onChange: setProfile, profiles: PROFILES }}
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
      />
    );
  },
};

/** Router-backed: no harness — model + effort + a universal agent profile. */
export const RouterBacked: Story = {
  name: "Router-backed (model · effort · agent)",
  render: () => {
    const [value, setValue] = useState("");
    const [model, setModel] = useState("openai/gpt-5.4");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
    const [profile, setProfile] = useState("chat");
    return (
      <AgentComposer
        value={value}
        onChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask anything…"
        profile={{ value: profile, onChange: setProfile, profiles: PROFILES }}
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
      />
    );
  },
};

/** Attachments + streaming: drag-drop / attach buttons, file chips, Stop button. */
export const WithAttachmentsAndStreaming: Story = {
  name: "Attachments + streaming (Stop)",
  render: () => {
    const [value, setValue] = useState("Summarize the attached spec.");
    const [model, setModel] = useState("anthropic/claude-opus-4-8");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
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
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
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
    const [model, setModel] = useState("anthropic/claude-opus-4-8");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
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
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
      />
    );
  },
};

/** A failed upload chip shows its error and offers a retry action. */
export const WithErrorAndRetry: Story = {
  name: "Attachment error + retry",
  render: () => {
    const [value, setValue] = useState("");
    const [model, setModel] = useState("anthropic/claude-opus-4-8");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
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
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
      />
    );
  },
};

/** Profile authoring: a capability catalog + write callbacks enable New/edit. */
export const ProfileAuthoring: Story = {
  name: "Router-backed + agent authoring",
  render: () => {
    const [value, setValue] = useState("");
    const [model, setModel] = useState("anthropic/claude-sonnet-4-6");
    const [reasoning, setReasoning] = useState<ReasoningLevel>("auto");
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
        profile={{
          value: profile,
          onChange: setProfile,
          profiles,
          capabilities: CAPABILITIES,
          onCreate: create,
          onUpdate: update,
          onDelete: remove,
        }}
        model={{ value: model, onChange: setModel, models: MODELS }}
        reasoning={{
          value: reasoning,
          onChange: setReasoning,
          options: DEFAULT_REASONING_LEVEL_OPTIONS,
        }}
      />
    );
  },
};
