import { jsxs, jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
import type { EmailContent, BrandTokens } from "../types";

export interface EmailPreviewProps {
  content: EmailContent;
  brand: BrandTokens;
  previewUrl?: string;
  className?: string;
}

export function EmailPreview({ content, brand, previewUrl, className }: EmailPreviewProps) {
  if (previewUrl) {
    return jsxs("div", { className: cn("flex flex-col gap-1", className), children: [
      jsx("div", { className: "text-xs text-muted-foreground font-medium truncate", children: content.subject }),
      content.preheader && jsx("div", { className: "text-xs text-muted-foreground/60 truncate", children: content.preheader }),
      jsx(
        "iframe",
        {
          src: previewUrl,
          className: "w-full rounded border border-border",
          style: { height: 480, background: "#fff" },
          title: "Email preview",
          sandbox: "allow-same-origin"
        }
      )
    ] });
  }
  return jsxs("div", { className: cn("flex flex-col gap-2", className), children: [
    jsx("div", { className: "text-sm font-semibold truncate", children: content.subject }),
    content.preheader && jsx("div", { className: "text-xs text-muted-foreground truncate", children: content.preheader }),
    jsx(
      "div",
      {
        className: "rounded border border-border p-4 space-y-3 overflow-y-auto",
        style: { maxHeight: 480, fontFamily: brand.fontFamily, color: brand.textColor },
        children: content.sections.map((section, i) => {
          if (section.type === "hero") {
            return jsxs("div", { className: "text-center py-4 space-y-2", children: [
              section.imageUrl && jsx("img", { src: section.imageUrl, alt: "", className: "mx-auto max-h-40 object-cover rounded" }),
              jsx("div", { className: "text-xl font-bold", style: { color: brand.primaryColor }, children: section.headline }),
              section.subheadline && jsx("div", { className: "text-sm text-muted-foreground", children: section.subheadline }),
              section.ctaLabel && jsx(
                "a",
                {
                  href: section.ctaUrl ?? "#",
                  className: "inline-block px-4 py-2 rounded text-sm font-medium text-white",
                  style: { background: brand.primaryColor },
                  children: section.ctaLabel
                }
              )
            ] }, i);
          }
          if (section.type === "body") {
            return jsx("p", { className: "text-sm leading-relaxed whitespace-pre-wrap", children: section.text }, i);
          }
          if (section.type === "feature") {
            return jsxs("div", { className: "flex gap-3 items-start", children: [
              section.imageUrl && jsx("img", { src: section.imageUrl, alt: "", className: "w-16 h-16 object-cover rounded shrink-0" }),
              jsxs("div", { children: [
                jsx("div", { className: "text-sm font-semibold", children: section.headline }),
                jsx("div", { className: "text-xs text-muted-foreground mt-0.5", children: section.description })
              ] })
            ] }, i);
          }
          if (section.type === "testimonial") {
            return jsxs("blockquote", { className: "border-l-2 pl-3 italic text-sm text-muted-foreground", style: { borderColor: brand.accentColor }, children: [
              jsxs("p", { children: [
                '"',
                section.quote,
                '"'
              ] }),
              jsxs("footer", { className: "mt-1 text-xs not-italic font-medium", children: [
                section.author,
                section.role ? `, ${section.role}` : ""
              ] })
            ] }, i);
          }
          if (section.type === "cta") {
            return jsxs("div", { className: "text-center py-3 space-y-1", children: [
              jsx(
                "a",
                {
                  href: section.url,
                  className: "inline-block px-5 py-2.5 rounded font-medium text-white text-sm",
                  style: { background: brand.primaryColor },
                  children: section.label
                }
              ),
              section.subtext && jsx("p", { className: "text-xs text-muted-foreground", children: section.subtext })
            ] }, i);
          }
          if (section.type === "divider") {
            return jsx("hr", { className: "border-border" }, i);
          }
          return null;
        })
      }
    )
  ] });
}
