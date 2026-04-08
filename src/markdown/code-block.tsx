import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils";

// Theme-aware syntax highlighting — reads CSS custom properties at render time.
// Override --syntax-* tokens in tokens.css per theme.
function getSyntaxTheme(): { [key: string]: React.CSSProperties } {
  const el = typeof document !== "undefined" ? document.documentElement : null;
  const v = (name: string, fallback: string) =>
    el ? getComputedStyle(el).getPropertyValue(name).trim() || fallback : fallback;

  const comment  = v("--syntax-comment", "#6B7094");
  const keyword  = v("--syntax-keyword", "#A78FFF");
  const string   = v("--syntax-string", "#10b981");
  const fn       = v("--syntax-function", "#6D9FFF");
  const number   = v("--syntax-number", "#FFB347");
  const meta     = v("--syntax-meta", "#8263FF");
  const error    = v("--syntax-error", "#FF4D6D");
  const variable = v("--syntax-variable", "#C4C0D8");
  const fg       = v("--syntax-foreground", "#E8E6F6");

  return {
    "hljs-comment":           { color: comment, fontStyle: "italic" },
    "hljs-quote":             { color: comment, fontStyle: "italic" },
    "hljs-doctag":            { color: comment },
    "hljs-keyword":           { color: keyword },
    "hljs-selector-tag":      { color: keyword },
    "hljs-literal":           { color: keyword },
    "hljs-type":              { color: keyword },
    "hljs-class":             { color: keyword },
    "hljs-string":            { color: string },
    "hljs-template-tag":      { color: string },
    "hljs-template-variable": { color: string },
    "hljs-addition":          { color: string },
    "hljs-regexp":            { color: string },
    "hljs-title":             { color: fn },
    "hljs-section":           { color: fn },
    "hljs-built_in":          { color: fn },
    "hljs-name":              { color: fn },
    "hljs-function":          { color: fn },
    "hljs-selector-id":       { color: fn },
    "hljs-selector-class":    { color: fn },
    "hljs-attribute":         { color: fn },
    "hljs-number":            { color: number },
    "hljs-symbol":            { color: number },
    "hljs-bullet":            { color: number },
    "hljs-link":              { color: number, textDecoration: "underline" },
    "hljs-meta":              { color: meta },
    "hljs-selector-pseudo":   { color: meta },
    "hljs-deletion":          { color: error },
    "hljs-params":            { color: variable },
    "hljs-variable":          { color: variable },
    "hljs-tag":               { color: variable },
    "hljs-attr":              { color: variable },
    "hljs-subst":             { color: variable },
    "hljs-strong":            { fontWeight: "bold" },
    "hljs-emphasis":          { fontStyle: "italic" },
    "hljs":                   { color: fg, background: "transparent" },
  };
}

// tangleLight removed — getSyntaxTheme() reads --syntax-* CSS vars which are overridden
// per theme in tokens.css (vault, dawn themes set light values).

export interface CodeBlockProps extends HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  /** Force light theme; defaults to dark */
  light?: boolean;
  children?: ReactNode;
}

const LIGHT_THEMES = new Set(["vault", "dawn"]);

function detectLightTheme() {
  return (
    typeof document !== "undefined" &&
    LIGHT_THEMES.has(document.documentElement.getAttribute("data-sandbox-theme") ?? "")
  );
}

function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState(detectLightTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsLight(detectLightTheme());
    const observer = new MutationObserver(() => setIsLight(detectLightTheme()));
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
    const theme = getSyntaxTheme();
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
            <span className={cn("text-[calc(var(--font-size-xs)-1px)] font-mono font-medium uppercase tracking-widest", langColor)}>
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
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
