import { clsx } from "clsx";
import type React from "react";
import { useState } from "react";

export interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string;
  language?: string;
  showCopy?: boolean;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language,
  showCopy = true,
  showLineNumbers = false,
  className,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="group relative">
      <pre
        className={clsx(
          "overflow-x-auto rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 font-mono text-sm",
          className,
        )}
        {...props}
      >
        <code className={language ? `language-${language}` : undefined}>
          {showLineNumbers ? (
            <table className="w-full">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="w-8 select-none pr-4 text-right text-[#525252]">
                      {i + 1}
                    </td>
                    <td className="text-[#a1a1a1]">{line || " "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="text-[#a1a1a1]">{code}</span>
          )}
        </code>
      </pre>
      {showCopy && (
        <button
          onClick={handleCopy}
          className={clsx(
            "absolute top-2 right-2 rounded px-2 py-1 text-xs",
            "bg-[#262626] text-[#a1a1a1] hover:bg-[#363636] hover:text-white",
            "opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

export interface InlineCodeProps extends React.HTMLAttributes<HTMLElement> {}

export function InlineCode({ className, children, ...props }: InlineCodeProps) {
  return (
    <code
      className={clsx(
        "rounded border border-[#262626] bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
