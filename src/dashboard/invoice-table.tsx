"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface Invoice {
  id: string
  date: string
  amount: number
  status: "paid" | "pending" | "failed"
}

export interface InvoiceTableProps {
  invoices: Invoice[]
  onExportAll?: () => void
  onLoadMore?: () => void
  onViewInvoice?: (id: string) => void
  hasMore?: boolean
  className?: string
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

const statusStyle: Record<string, string> = {
  paid: "bg-md3-primary/10 text-md3-primary",
  pending: "bg-yellow-500/10 text-yellow-400",
  failed: "bg-red-500/10 text-red-400",
}

export function InvoiceTable({ invoices, onExportAll, onLoadMore, onViewInvoice, hasMore, className }: InvoiceTableProps) {
  return (
    <section className={className}>
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Invoice History</h2>
        {onExportAll && (
          <button type="button" onClick={onExportAll} className="text-[10px] font-mono text-md3-primary uppercase tracking-widest flex items-center gap-2 hover:underline">
            <MaterialIcon name="download" className="text-sm" />
            Export All
          </button>
        )}
      </div>
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high">
              <th className="px-6 py-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Invoice ID</th>
              <th className="px-6 py-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="px-6 py-5 font-mono text-xs text-white">{inv.id}</td>
                <td className="px-6 py-5 text-sm text-on-surface-variant">{inv.date}</td>
                <td className="px-6 py-5 text-sm font-bold text-white">${inv.amount.toFixed(2)}</td>
                <td className="px-6 py-5">
                  <span className={cn("px-2 py-1 text-[10px] font-mono rounded uppercase", statusStyle[inv.status] ?? statusStyle.paid)}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button type="button" onClick={() => onViewInvoice?.(inv.id)} className="text-on-surface-variant hover:text-white transition-colors">
                    <MaterialIcon name="description" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && onLoadMore && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onLoadMore} className="px-8 py-2 text-[10px] font-mono text-on-surface-variant border border-outline-variant/30 rounded-full hover:bg-surface-container transition-colors uppercase tracking-widest">
            Load More History
          </button>
        </div>
      )}
    </section>
  )
}
