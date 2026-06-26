import type { Meta, StoryObj } from "@storybook/react";
import {
  type AssistantClient,
  type AssistantModelsResult,
  type AssistantThreadSummary,
  createAssistantClient,
} from "./client";
import { AssistantClientProvider } from "./client-context";
import { AssistantPanel } from "./AssistantPanel";
import { type AssistantState, initialAssistantState } from "./reducer";
import type { AssistantChat } from "./useAssistantChat";

/**
 * Visual harness for the assistant panel chrome (header, text-size control,
 * history view, composer with its searchable model picker). The transport is faked
 * so the model catalog and thread history populate without a backend; the chat
 * state is a static slice (the panel never streams here).
 */

const MODELS: AssistantModelsResult = {
  ok: true,
  data: {
    default: "anthropic/claude-sonnet-4-6",
    models: [
      { slug: "anthropic/claude-opus-4-8", label: "Claude Opus 4.8", contextTokens: 200_000 },
      { slug: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", contextTokens: 1_000_000 },
      { slug: "openai/gpt-5.4", label: "GPT-5.4", contextTokens: 400_000 },
      { slug: "openai/gpt-5.4-mini", label: "GPT-5.4 mini", contextTokens: 400_000 },
      { slug: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", contextTokens: 1_000_000 },
      { slug: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", contextTokens: 1_000_000 },
      { slug: "zhipu/glm-5", label: "GLM-5", contextTokens: 128_000 },
      { slug: "deepseek/deepseek-v3", label: "DeepSeek V3", contextTokens: 64_000 },
      { slug: "moonshot/kimi-k2", label: "Kimi K2", contextTokens: 256_000 },
    ],
  },
};

const THREADS: AssistantThreadSummary[] = [
  { id: "t1", title: "Create a workflow that triggers when I open a PR", createdAt: "", updatedAt: "" },
  { id: "t2", title: "Check my usage for this month", createdAt: "", updatedAt: "" },
  { id: "t3", title: "Rotate the production API key", createdAt: "", updatedAt: "" },
];

function fakeClient(): AssistantClient {
  return {
    ...createAssistantClient({ baseUrl: "/api/v1/assistant" }),
    fetchModels: async () => MODELS,
    fetchThreads: async () => THREADS,
    deleteThread: async () => ({ ok: true }),
  };
}

function makeChat(over: Partial<AssistantState> = {}): AssistantChat {
  return {
    state: { ...initialAssistantState(), ownerId: "u1", ...over },
    confirmingIds: new Set<string>(),
    selectedModel: "zhipu/glm-5",
    setModel: () => {},
    send: () => {},
    stop: () => {},
    confirm: async () => {},
    cancel: () => {},
    reset: () => {},
    switchThread: () => {},
    restoring: false,
  };
}

const SAMPLE_MESSAGES: AssistantState["messages"] = [
  {
    id: "u1",
    role: "user",
    text: "Create a workflow that reviews opened PRs with a cheap but good model and posts the review as a comment.",
  },
  {
    id: "a1",
    role: "assistant",
    text: "Here's the plan:\n\n**Create workflow `pr-code-review`** — on every opened PR it clones the repo into a sandbox, runs the built-in `code-reviewer` profile, then posts the structured markdown review as a GitHub PR comment.\n\nTwo steps:\n\n- `agent.run` — clones the PR source and reviews the diff.\n- `integration.invoke` — posts the review via `github.pulls.reviews.create`.",
  },
];

function PanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark h-[720px] w-[460px] overflow-hidden rounded-lg border border-border shadow-xl">
      {children}
    </div>
  );
}

const meta: Meta<typeof AssistantPanel> = {
  title: "Assistant/AssistantPanel",
  parameters: { layout: "centered", backgrounds: { default: "dark" } },
};

export default meta;
type Story = StoryObj<typeof AssistantPanel>;

export const Conversation: Story = {
  render: () => {
    const chat = makeChat({ messages: SAMPLE_MESSAGES, model: "zhipu/glm-5" });
    return (
      <AssistantClientProvider client={fakeClient()}>
        <PanelFrame>
          <AssistantPanel chat={chat} userId="u1" onClose={() => {}} />
        </PanelFrame>
      </AssistantClientProvider>
    );
  },
};

export const EmptyState: Story = {
  render: () => {
    const chat = makeChat();
    return (
      <AssistantClientProvider client={fakeClient()}>
        <PanelFrame>
          <AssistantPanel chat={chat} userId="u1" onClose={() => {}} />
        </PanelFrame>
      </AssistantClientProvider>
    );
  },
};
