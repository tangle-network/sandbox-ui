"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface CreditBalanceProps {
  amount: number;
  description?: string;
  onTopUp?: (amount: number) => void;
  quickAmounts?: number[];
  className?: string;
}

export function CreditBalance({
  amount,
  description = "Credits are automatically deducted based on hourly Sandbox usage and Agent operations.",
  onTopUp,
  quickAmounts = [10, 25, 100],
  className,
}: CreditBalanceProps) {
  const [topUpValue, setTopUpValue] = React.useState("50.00");

  return (
    <div
      className={cn(
        "bg-card p-5 rounded-xl flex flex-col justify-between border border-border",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Available Credits
        </h3>
        <div className="text-4xl font-extrabold text-primary tracking-tighter mb-2">
          ${amount.toFixed(2)}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {onTopUp && (
        <div className="space-y-2.5 mt-5">
          <div className="bg-card border border-border p-1 rounded-lg flex items-center">
            <input
              type="text"
              value={`$${topUpValue}`}
              onChange={(e) =>
                setTopUpValue(e.target.value.replace(/[^0-9.]/g, ""))
              }
              className="bg-transparent border-none text-foreground font-mono text-lg w-full focus:ring-0 px-4 outline-none"
            />
            <button
              type="button"
              onClick={() => onTopUp(Number.parseFloat(topUpValue))}
              className="bg-[var(--accent-surface-soft)] border border-border text-[var(--accent-text)] px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest active:scale-95 transition-transform hover:bg-[var(--accent-surface-strong)]"
            >
              Top Up
            </button>
          </div>
          <div className="flex justify-between gap-2">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => {
                  setTopUpValue(String(qa));
                  onTopUp(qa);
                }}
                className="flex-1 py-2 text-[10px] font-mono text-muted-foreground border border-border rounded-md hover:bg-muted/50 hover:text-foreground transition-colors uppercase"
              >
                +${qa}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
