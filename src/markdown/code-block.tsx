import {
  memo,
  useCallback,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils";

// Tangle brand dark theme — maps to our design tokens
const tangleDark: { [key: string]: React.CSSProperties } = {
  "hljs-comment":           { color: "#6B7094", fontStyle: "italic" },
  "hljs-quote":             { color: "#6B7094", fontStyle: "italic" },
  "hljs-doctag":            { color: "#6B7094" },
  "hljs-keyword":           { color: "#A78FFF" },
  "hljs-selector-tag":      { color: "#A78FFF" },
  "hljs-literal":           { color: "#A78FFF" },
  "hljs-type":              { color: "#A78FFF" },
  "hljs-class":             { color: "#A78FFF" },
  "hljs-string":            { color: "#10b981" },
  "hljs-template-tag":      { color: "#10b981" },
  "hljs-template-variable": { color: "#10b981" },
  "hljs-addition":          { color: "#10b981" },
  "hljs-regexp":            { color: "#10b981" },
  "hljs-title":             { color: "#6D9FFF" },
  "hljs-section":           { color: "#6D9FFF" },
  "hljs-built_in":          { color: "#6D9FFF" },
  "hljs-name":              { color: "#6D9FFF" },
  "hljs-function":          { color: "#6D9FFF" },
  "hljs-selector-id":       { color: "#6D9FFF" },
  "hljs-selector-class":    { color: "#6D9FFF" },
  "hljs-attribute":         { color: "#6D9FFF" },
  "hljs-number":            { color: "#FFB347" },
  "hljs-symbol":            { color: "#FFB347" },
  "hljs-bullet":            { color: "#FFB347" },
  "hljs-link":              { color: "#FFB347", textDecoration: "underline" },
  "hljs-meta":              { color: "#8263FF" },
  "hljs-selector-pseudo":   { color: "#8263FF" },
  "hljs-deletion":          { color: "#FF4D6D" },
  "hljs-params":            { color: "#C4C0D8" },
  "hljs-variable":          { color: "#C4C0D8" },
  "hljs-tag":               { color: "#C4C0D8" },
  "hljs-attr":              { color: "#C4C0D8" },
  "hljs-subst":             { color: "#C4C0D8" },
  "hljs-strong":            { fontWeight: "bold" },
  "hljs-emphasis":          { fontStyle: "italic" },
  "hljs":                   { color: "#E8E6F6", background: "transparent" },
};

// Light theme for vault/light contexts
const tangleLight: { [key: string]: React.CSSProperties } = {
  "hljs-comment":           { color: "#8B92B8", fontStyle: "italic" },
  "hljs-quote":             { color: "#8B92B8", fontStyle: "italic" },
  "hljs-doctag":            { color: "#8B92B8" },
  "hljs-keyword":           { color: "#5B3FCC" },
  "hljs-selector-tag":      { color: "#5B3FCC" },
  "hljs-literal":           { color: "#5B3FCC" },
  "hljs-type":              { color: "#5B3FCC" },
  "hljs-class":             { color: "#5B3FCC" },
  "hljs-string":            { color: "#0D7A57" },
  "hljs-template-tag":      { color: "#0D7A57" },
  "hljs-template-variable": { color: "#0D7A57" },
  "hljs-addition":          { color: "#0D7A57" },
  "hljs-regexp":            { color: "#0D7A57" },
  "hljs-title":             { color: "#1B5EBF" },
  "hljs-section":           { color: "#1B5EBF" },
  "hljs-built_in":          { color: "#1B5EBF" },
  "hljs-name":              { color: "#1B5EBF" },
  "hljs-function":          { color: "#1B5EBF" },
  "hljs-selector-id":       { color: "#1B5EBF" },
  "hljs-selector-class":    { color: "#1B5EBF" },
  "hljs-attribute":         { color: "#1B5EBF" },
  "hljs-number":            { color: "#B85C00" },
  "hljs-symbol":            { color: "#B85C00" },
  "hljs-bullet":            { color: "#B85C00" },
  "hljs-link":              { color: "#B85C00", textDecoration: "underline" },
  "hljs-meta":              { color: "#6940C4" },
  "hljs-selector-pseudo":   { color: "#6940C4" },
  "hljs-deletion":          { color: "#CC1A3A" },
  "hljs-params":            { color: "#2D2D4A" },
  "hljs-variable":          { color: "#2D2D4A" },
  "hljs-tag":               { color: "#2D2D4A" },
  "hljs-attr":              { color: "#2D2D4A" },
  "hljs-subst":             { color: "#2D2D4A" },
  "hljs-strong":            { fontWeight: "bold" },
  "hljs-emphasis":          { fontStyle: "italic" },
  "hljs":                   { color: "#1A1A2E", background: "transparent" },
};

export interface CodeBlockProps extends HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  /** Force light theme; defaults to dark */
  light?: boolean;
  children?: ReactNode;
}

const LIGHT_THEMES = new Set(["vault", "dawn"]);

function useIsLightTheme(): boolean {
  const detect = () =>
    typeof document !== "undefined" &&
    LIGHT_THEMES.has(document.documentElement.getAttribute("data-sandbox-theme") ?? "");

  const [isLight, setIsLight] = useState(detect);

  useEffect(() => {
    setIsLight(detect());
    const observer = new MutationObserver(() => setIsLight(detect()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sandbox-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return isLight;
}

export const CodeBlock = memo(
  ({ code, language, showLineNumbers = false, light: lightProp, className, children, ...props }: CodeBlockProps) => {
    const isLight = useIsLightTheme();
    const light = lightProp ?? isLight;
    const theme = light ? tangleLight : tangleDark;
    const bg = "bg-card border-border";
    const headerBg = light ? "bg-muted/50 border-border" : "bg-background border-border";
    const langColor = "text-muted-foreground";

    return (
      <div
        className={cn("group relative overflow-hidden rounded-lg border font-mono", bg, className)}
        {...props}
      >
        {language && (
          <div className={cn("flex items-center justify-between border-b px-3 py-1", headerBg)}>
            <span className={cn("text-[10px] font-mono font-medium uppercase tracking-widest", langColor)}>
              {language}
            </span>
            {children}
          </div>
        )}
        {!language && children && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {children}
          </div>
        )}
        <SyntaxHighlighter
          language={language ?? "text"}
          style={theme}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            color: light ? "#8B92B8" : "#4A4D6A",
            minWidth: "2.5em",
            paddingRight: "1em",
          }}
          customStyle={{
            margin: 0,
            padding: "var(--code-padding-y, 0.625rem) var(--code-padding-x, 0.75rem)",
            background: "transparent",
            fontSize: "var(--code-font-size, 0.8125rem)",
            lineHeight: "var(--code-line-height, 1.5)",
            overflowX: "auto",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)" } }}
          wrapLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

/** Copy-to-clipboard button for use inside CodeBlock. */
export const CopyButton = memo(({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-center w-6 h-6 rounded-md bg-muted border border-border hover:border-primary/20 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
});
CopyButton.displayName = "CopyButton";
