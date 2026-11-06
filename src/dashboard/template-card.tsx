"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import { Tag } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"

export interface TemplateCardData {
  id: string
  name: string
  description: string
  icon?: React.ReactNode
  tags?: string[]
}

export interface TemplateCardProps {
  template: TemplateCardData
  onUseTemplate: (templateId: string) => void
  className?: string
}

export function TemplateCard({ template, onUseTemplate, className }: TemplateCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-[var(--md3-outline-variant)] bg-surface-container p-6 transition-colors hover:border-[var(--border-accent)]",
        className,
      )}
    >
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high border border-[var(--md3-outline-variant)]">
          {template.icon ?? (
            <span className="text-lg font-semibold text-[var(--accent-text)]">
              {template.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="mb-1 text-base font-semibold text-foreground">{template.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
        {template.tags && template.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {template.tags.map((tag, i) => (
              <Tag key={`${tag}-${i}`}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onUseTemplate(template.id)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-medium text-[var(--accent-text)] transition-colors hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
      >
        Use template
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}
