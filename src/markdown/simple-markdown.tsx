/**
 * SimpleMarkdown — lightweight markdown renderer with Tangle styling.
 *
 * GFM tables, fenced code blocks with syntax highlighting,
 * lists, links, blockquotes, headings. Tangle dark theme.
 * No external dependencies (no react-markdown).
 */

import { type ReactNode } from "react";
import { cn } from "../lib/utils";

export interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer — no external dependency.
 * Handles the common patterns: headings, bold, italic, code, links, lists, tables, blockquotes.
 * For full GFM, consumers can swap in react-markdown at the app level.
 */
export function SimpleMarkdown({ content, className }: SimpleMarkdownProps) {
  const html = renderMarkdown(content);
  return (
    <div
      className={cn("tangle-prose", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// --- Minimal markdown -> HTML renderer ---

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let result = escapeHtml(text);
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="tangle-inline-code">$1</code>');
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="tangle-link">$1</a>');
  return result;
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const output: string[] = [];
  let i = 0;
  let inList = false;
  let listType = "ul";

  const closeList = () => {
    if (inList) {
      output.push(`</${listType}>`);
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      closeList();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = escapeHtml(codeLines.join("\n"));
      output.push(`<div class="tangle-code-block">`);
      if (lang) output.push(`<div class="tangle-code-lang">${escapeHtml(lang)}</div>`);
      output.push(`<pre><code>${code}</code></pre></div>`);
      continue;
    }

    // Table (detect header row with |)
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s-:|]+\|/.test(lines[i + 1])) {
      closeList();
      const headers = line.split("|").map(h => h.trim()).filter(Boolean);
      i += 2; // skip header + separator
      output.push('<div class="tangle-table-wrap"><table class="tangle-table">');
      output.push("<thead><tr>");
      for (const h of headers) output.push(`<th>${renderInline(h)}</th>`);
      output.push("</tr></thead><tbody>");
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i].split("|").map(c => c.trim()).filter(Boolean);
        output.push("<tr>");
        for (const c of cells) output.push(`<td>${renderInline(c)}</td>`);
        output.push("</tr>");
        i++;
      }
      output.push("</tbody></table></div>");
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      output.push(`<h${level} class="tangle-h${level}">${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      closeList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      output.push(`<blockquote class="tangle-blockquote">${quoteLines.map(renderInline).join("<br>")}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*+]\s/.test(line)) {
      if (!inList || listType !== "ul") {
        closeList();
        output.push('<ul class="tangle-list">');
        inList = true;
        listType = "ul";
      }
      output.push(`<li>${renderInline(line.replace(/^[\s]*[-*+]\s/, ""))}</li>`);
      i++;
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      if (!inList || listType !== "ol") {
        closeList();
        output.push('<ol class="tangle-list tangle-list-ordered">');
        inList = true;
        listType = "ol";
      }
      output.push(`<li>${renderInline(line.replace(/^[\s]*\d+\.\s/, ""))}</li>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      closeList();
      output.push('<hr class="tangle-hr">');
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    // Paragraph
    closeList();
    output.push(`<p>${renderInline(line)}</p>`);
    i++;
  }

  closeList();
  return output.join("\n");
}

/**
 * CSS for the markdown renderer. Import this in your app's global styles
 * or include via <style> tag.
 */
export const simpleMarkdownStyles = `
.tangle-prose {
  font-family: var(--font-sans);
  color: var(--text-primary);
  font-size: 0.9375rem;
  line-height: 1.6;
}
.tangle-prose p { margin: 0.5em 0; }
.tangle-prose p:last-child { margin-bottom: 0; }
.tangle-h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.5em; }
.tangle-h2 { font-size: 1.25rem; font-weight: 700; margin: 1em 0 0.5em; }
.tangle-h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75em 0 0.4em; }
.tangle-h4, .tangle-h5, .tangle-h6 { font-size: 1rem; font-weight: 600; margin: 0.5em 0 0.3em; }
.tangle-inline-code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--bg-input);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.15em 0.4em;
}
.tangle-code-block {
  position: relative;
  margin: 0.75em 0;
  background: var(--bg-input);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.tangle-code-lang {
  position: absolute;
  top: 8px;
  right: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.tangle-code-block pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}
.tangle-link {
  color: var(--brand-cool);
  text-decoration: none;
}
.tangle-link:hover { text-decoration: underline; }
.tangle-blockquote {
  border-left: 3px solid var(--border-accent);
  padding: 0.5em 1em;
  margin: 0.5em 0;
  color: var(--text-secondary);
}
.tangle-list {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.tangle-list li { margin: 0.2em 0; }
.tangle-list-ordered { list-style-type: decimal; }
.tangle-table-wrap { overflow-x: auto; margin: 0.75em 0; }
.tangle-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.tangle-table th {
  text-align: left;
  padding: 0.5em 0.75em;
  border-bottom: 2px solid var(--border-default);
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.tangle-table td {
  padding: 0.4em 0.75em;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}
.tangle-table tr:hover td { background: var(--bg-hover); }
.tangle-hr {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 1em 0;
}
strong { font-weight: 700; }
em { font-style: italic; }
`;
