"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../lib/utils"

export interface PlanFeature {
  text: string
}

export interface PlanCardData {
  id: string
  name: string
  price: number
  period?: string
  features: PlanFeature[]
  popular?: boolean
  current?: boolean
  ctaLabel?: string
  onSelect?: (id: string) => void
}

export interface PlanCardsProps {
  plans: PlanCardData[]
  className?: string
}

export function PlanCards({ plans, className }: PlanCardsProps) {
  return (
    <section className={className}>
      <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-5 px-2">Subscription Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "p-5 rounded-xl transition-all relative overflow-hidden border",
              plan.popular
                ? "bg-muted/50 border-border"
                : "bg-card border-border hover:bg-muted/50 hover:border-primary/20",
            )}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-[var(--accent-surface-soft)] border-l border-b border-border px-4 py-1 text-[10px] font-bold text-[var(--accent-text)] uppercase tracking-widest rounded-bl-lg">
                Popular
              </div>
            )}
            <div className="mb-4">
              <div className={cn("text-xs font-mono uppercase tracking-widest mb-2", plan.popular ? "text-[var(--brand-cool)]" : "text-[var(--text-muted)]")}>
                {plan.name}
              </div>
              <div className="text-3xl font-bold text-foreground">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground tracking-normal">/{plan.period ?? "mo"}</span>
              </div>
            </div>
            <ul className="space-y-2 mb-5 text-sm text-[var(--text-muted)]">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => plan.onSelect?.(plan.id)}
              className={cn(
                "w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border",
                plan.current
                  ? "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  : plan.popular
                    ? "bg-[var(--accent-surface-soft)] border-border text-[var(--accent-text)] hover:bg-[var(--accent-surface-strong)] active:scale-95 transition-transform"
                    : "border-border text-foreground hover:border-primary/20 hover:text-primary",
              )}
            >
              {plan.ctaLabel ?? (plan.current ? "Current Plan" : "Upgrade Now")}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
