import type { ToolPart } from "./parts";
import type { ReactNode } from "react";

/**
 * Variant-specific rendering instructions for tool output.
 * Maps directly to specialised preview components.
 */
export type DisplayVariant =
  | "command"
  | "write-file"
  | "read-file"
  | "diff"
  | "question"
  | "web-search"
  | "grep"
  | "glob"
  | "default";

/**
 * Custom renderer for tool details. Return a ReactNode to override the
 * default ExpandedToolDetail, or null to fall back to the built-in renderer.
 */
export type CustomToolRenderer = (part: ToolPart) => ReactNode | null;

/**
 * Visual metadata for a tool invocation — computed from the tool name,
 * input, and output by `getToolDisplayMetadata()`.
 */
export interface ToolDisplayMetadata {
  title: string;
  description?: string;
  inputTitle?: string;
  outputTitle?: string;
  inputLanguage?: string;
  outputLanguage?: string;
  hasDiffOutput?: boolean;
  diffFilePath?: string;
  displayVariant?: DisplayVariant;
  commandSnippet?: string;
  targetPath?: string;
}
