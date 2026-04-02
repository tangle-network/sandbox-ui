"use client"

import * as React from "react"
import { Clock, Layers, MessageSquare, DollarSign } from "lucide-react"
import { cn } from "../lib/utils"
import { StatCard } from "../primitives/stat-card"
import { Skeleton } from "../primitives/skeleton"

export interface UsageSummaryData {
  computeHours: number
  activeSessions: number
  messagesSent: number
  estimatedCost: number
}

export interface UsageSummaryProps {
  data: UsageSummaryData | null
  loading?: boolean
  className?: string
}

export function UsageSummary({ data, loading = false, className }: UsageSummaryProps) {
  if (loading || !data) {
    return (
      <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      <StatCard
        variant="sandbox"
        title="Compute Hours"
        value={data.computeHours.toFixed(1)}
        subtitle="This billing period"
        icon={<Clock className="h-5 w-5" />}
      />
      <StatCard
        variant="sandbox"
        title="Active Sessions"
        value={data.activeSessions}
        subtitle="Currently running"
        icon={<Layers className="h-5 w-5" />}
      />
      <StatCard
        variant="sandbox"
        title="Messages Sent"
        value={data.messagesSent.toLocaleString()}
        subtitle="Agent interactions"
        icon={<MessageSquare className="h-5 w-5" />}
      />
      <StatCard
        variant="sandbox"
        title="Estimated Cost"
        value={`$${data.estimatedCost.toFixed(2)}`}
        subtitle="This billing period"
        icon={<DollarSign className="h-5 w-5" />}
      />
    </div>
  )
}
