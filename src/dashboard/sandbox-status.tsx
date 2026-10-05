import { StatusPill, type StatusPillProps, type StatusTone } from "@tangle-network/ui/primitives"
import type { SandboxStatus } from "./sandbox-card"

/**
 * The one mapping from a sandbox's lifecycle state to a status tone and label.
 * Cards, tables and products read it here, so a state cannot be green in one
 * place and grey in another.
 *
 * A lifecycle state is domain meaning, so it lives in sandbox-ui; the tones and
 * the pill are ui's `StatusPill`. Running is up and healthy (success). Creating
 * and provisioning are still in progress (StatusPill's `running`, an open
 * ring). Failed needs attention (danger). The resting states — hibernating,
 * stopped, expired, archived — need nothing from the user, so they are neutral
 * and told apart by their labels.
 */
export const SANDBOX_STATUS: Record<SandboxStatus, { label: string; tone: StatusTone }> = {
  running: { label: "Running", tone: "success" },
  creating: { label: "Creating", tone: "running" },
  provisioning: { label: "Provisioning", tone: "running" },
  hibernating: { label: "Hibernating", tone: "neutral" },
  stopped: { label: "Stopped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
}

/** A state the API added after this release reads as neutral, with its own name. */
export function sandboxStatus(status: SandboxStatus | (string & {})): { label: string; tone: StatusTone } {
  return (
    SANDBOX_STATUS[status as SandboxStatus] ?? {
      label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown",
      tone: "neutral",
    }
  )
}

export interface SandboxStatusPillProps extends Omit<StatusPillProps, "tone" | "children"> {
  status: SandboxStatus | (string & {})
}

/** `StatusPill` for a sandbox lifecycle state. */
export function SandboxStatusPill({ status, ...props }: SandboxStatusPillProps) {
  const { label, tone } = sandboxStatus(status)
  return (
    <StatusPill tone={tone} {...props}>
      {label}
    </StatusPill>
  )
}
