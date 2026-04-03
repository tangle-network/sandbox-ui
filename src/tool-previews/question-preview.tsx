import { memo, useMemo } from "react";
import { MessageSquareQuote } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { PreviewCard, PreviewEmpty, PreviewError, PreviewLoading } from "./preview-primitives";

function toQuestionList(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    return [input];
  }

  if (Array.isArray(input)) {
    return input.map((item) => String(item)).filter(Boolean);
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    const value = record.questions ?? record.question ?? record.prompt;

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }

    if (typeof value === "string") {
      return [value];
    }
  }

  return [];
}

function toAnswerList(output: unknown): string[] {
  if (!output) {
    return [];
  }

  if (typeof output === "string") {
    return [output];
  }

  if (Array.isArray(output)) {
    return output.map((item) => String(item)).filter(Boolean);
  }

  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    const value = record.answers ?? record.answer ?? record.response;

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }

    if (typeof value === "string") {
      return [value];
    }
  }

  return [];
}

export interface QuestionPreviewProps {
  part: ToolPart;
}

export const QuestionPreview = memo(({ part }: QuestionPreviewProps) => {
  const questions = useMemo(() => toQuestionList(part.state.input), [part.state.input]);
  const answers = useMemo(() => toAnswerList(part.state.output), [part.state.output]);

  return (
    <PreviewCard
      icon={<MessageSquareQuote className="h-4 w-4" />}
      title="Agent question"
      description={questions.length > 1 ? `${questions.length} questions require attention` : undefined}
    >
      {part.state.status === "running" ? <PreviewLoading label="Waiting for an answer…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      {questions.length === 0 ? <PreviewEmpty label="No question text was provided." /> : null}
      {questions.map((question, index) => (
        <div
          key={`${question}-${index}`}
          className="rounded-[var(--radius-md)] border border-border bg-muted px-3 py-3"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Question {index + 1}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-foreground">
            {question}
          </div>
          <div className="mt-3 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-sm text-foreground">
            {answers[index] ?? (part.state.status === "completed" ? "No answer recorded." : "Awaiting answer")}
          </div>
        </div>
      ))}
    </PreviewCard>
  );
});

QuestionPreview.displayName = "QuestionPreview";
