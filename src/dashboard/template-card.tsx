"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
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
        "group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border">
          {template.icon ?? (
            <span className="text-lg font-bold text-primary">
              {template.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="mb-1 text-base font-bold text-foreground">{template.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
        {template.tags && template.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {template.tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onUseTemplate(template.id)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
      >
        Use Template
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}
