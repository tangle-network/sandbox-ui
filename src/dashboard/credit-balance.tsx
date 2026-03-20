"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface CreditBalanceProps {
  amount: number
  description?: string
  onTopUp?: (amount: number) => void
  quickAmounts?: number[]
  className?: string
}

export function CreditBalance({
  amount,
  description = "Credits are automatically deducted based on hourly Sandbox usage and Agent operations.",
  onTopUp,
  quickAmounts = [10, 25, 100],
  className,
}: CreditBalanceProps) {
  const [topUpValue, setTopUpValue] = React.useState("50.00")

  return (
    <div className={cn("bg-gradient-to-br from-surface-container to-surface-container-high p-8 rounded-xl flex flex-col justify-between border border-md3-primary/10", className)}>
      <div>
        <h3 className="text-lg font-bold text-white tracking-tight mb-1">Available Credits</h3>
        <div className="text-5xl font-extrabold text-md3-primary tracking-tighter mb-4">${amount.toFixed(2)}</div>
        <p className="text-sm text-on-surface-variant leading-relaxed">{description}</p>
      </div>
      {onTopUp && (
        <div className="space-y-4 mt-8">
          <div className="bg-surface-container-lowest p-1 rounded-lg flex items-center">
            <input
              type="text"
              value={`$${topUpValue}`}
              onChange={(e) => setTopUpValue(e.target.value.replace(/[^0-9.]/g, ""))}
              className="bg-transparent border-none text-white font-mono text-lg w-full focus:ring-0 px-4"
            />
            <button
              type="button"
              onClick={() => onTopUp(Number.parseFloat(topUpValue))}
              className="bg-md3-primary text-on-primary px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest active:scale-95 transition-transform"
            >
              Top Up
            </button>
          </div>
          <div className="flex justify-between gap-2">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => { setTopUpValue(String(qa)); onTopUp(qa) }}
                className="flex-1 py-2 text-[10px] font-mono text-on-surface-variant border border-outline-variant/30 rounded-md hover:bg-surface-variant transition-colors uppercase"
              >
                +${qa}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
