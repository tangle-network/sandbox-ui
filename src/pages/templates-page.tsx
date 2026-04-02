"use client"

import * as React from "react"
import { Layers } from "lucide-react"
import { cn } from "../lib/utils"
import { TemplateCard, type TemplateCardData } from "../dashboard/template-card"
import { Skeleton } from "../primitives/skeleton"

export interface TemplatesPageProps {
  templates: TemplateCardData[] | null
  loading?: boolean
  onUseTemplate: (templateId: string) => void
  className?: string
}

export function TemplatesPage({ templates, loading = false, onUseTemplate, className }: TemplatesPageProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <div>
        <h1 className="font-bold text-3xl text-foreground">Templates</h1>
        <p className="mt-1 text-muted-foreground">
          Pre-configured environments to get started quickly
        </p>
      </div>

      {loading || !templates ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mb-1">No templates available</p>
          <p className="text-sm text-muted-foreground">Check back later for pre-configured environments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUseTemplate={onUseTemplate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
