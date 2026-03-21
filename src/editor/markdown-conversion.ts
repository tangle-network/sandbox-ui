import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
});

export function markdownToHtml(markdown: string) {
  return String(marked.parse(markdown, { async: false, gfm: true }));
}

export function htmlToMarkdown(html: string) {
  return turndown.turndown(html);
}

export function normalizeMarkdown(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").trimEnd();
}
