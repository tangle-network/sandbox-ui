"use client"

import * as React from "react"
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

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

export function PlanCards({ plans, className }: PlanCardsProps) {
  return (
    <section className={className}>
      <h2 className="text-2xl font-bold text-white tracking-tight mb-8 px-2">Subscription Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "p-8 rounded-xl transition-all",
              plan.popular
                ? "bg-surface-container-highest border-2 border-md3-primary/30 relative overflow-hidden"
                : "bg-surface-container-low group hover:bg-surface-container",
            )}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-md3-primary px-4 py-1 text-[10px] font-bold text-on-primary uppercase tracking-widest rounded-bl-lg">
                Popular
              </div>
            )}
            <div className="mb-6">
              <div className={cn("text-xs font-mono uppercase tracking-widest mb-2", plan.popular ? "text-md3-primary" : "text-on-surface-variant")}>
                {plan.name}
              </div>
              <div className="text-3xl font-bold text-white">
                ${plan.price}
                <span className="text-sm font-normal text-on-surface-variant tracking-normal">/{plan.period ?? "mo"}</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-on-surface-variant">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <MaterialIcon name="check" className="text-sm text-md3-primary" />
                  {f.text}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => plan.onSelect?.(plan.id)}
              className={cn(
                "w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                plan.current
                  ? "border border-outline-variant/40 text-on-surface-variant hover:border-md3-primary"
                  : plan.popular
                    ? "bg-gradient-to-r from-md3-primary to-primary-container text-on-primary shadow-lg shadow-md3-primary/20 active:scale-95 transition-transform"
                    : "border border-outline-variant/40 text-on-surface-variant hover:border-md3-primary",
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
