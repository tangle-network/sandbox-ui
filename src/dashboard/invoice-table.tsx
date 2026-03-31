"use client"

import * as React from "react"
import { Download, FileText } from "lucide-react"
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

const statusStyle: Record<string, string> = {
  paid: "bg-[var(--accent-surface-soft)] text-[var(--brand-cool)] border border-[var(--border-accent)]",
  pending: "bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)] border border-[var(--surface-warning-border)]",
  failed: "bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)] border border-[var(--surface-danger-border)]",
}

export function InvoiceTable({ invoices, onExportAll, onLoadMore, onViewInvoice, hasMore, className }: InvoiceTableProps) {
  return (
    <section className={className}>
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Invoice History</h2>
        {onExportAll && (
          <button type="button" onClick={onExportAll} className="text-[10px] font-mono text-[var(--brand-cool)] uppercase tracking-widest flex items-center gap-2 hover:underline">
            <Download className="h-3.5 w-3.5" />
            Export All
          </button>
        )}
      </div>
      <div className="bg-[var(--depth-2)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--depth-1)] border-b border-[var(--border-subtle)]">
              <th className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Invoice ID</th>
              <th className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[var(--depth-3)] transition-colors">
                <td className="px-6 py-5 font-mono text-xs text-[var(--text-primary)]">{inv.id}</td>
                <td className="px-6 py-5 text-sm text-[var(--text-secondary)]">{inv.date}</td>
                <td className="px-6 py-5 text-sm font-bold text-[var(--text-primary)]">${inv.amount.toFixed(2)}</td>
                <td className="px-6 py-5">
                  <span className={cn("px-2 py-1 text-[10px] font-mono rounded uppercase", statusStyle[inv.status] ?? statusStyle.paid)}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button type="button" onClick={() => onViewInvoice?.(inv.id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    <FileText className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && onLoadMore && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onLoadMore} className="px-8 py-2 text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-full hover:bg-[var(--depth-3)] transition-colors uppercase tracking-widest">
            Load More History
          </button>
        </div>
      )}
    </section>
  )
}
