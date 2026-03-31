"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Layers, Cpu, Bot, Info } from "lucide-react"
import { cn } from "../lib/utils"

export interface EnvironmentOption {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

export interface EnvironmentEntry {
  id: string
  description?: string
  version?: string
}

export interface ProvisioningWizardProps {
  environments?: EnvironmentOption[]
  onLoadEnvironments?: () => Promise<EnvironmentEntry[]>
  onSubmit?: (config: ProvisioningConfig) => void
  onBack?: () => void
  className?: string
}

export interface ProvisioningConfig {
  environment: string
  cpuCores: number
  ramGB: number
  storageGB: number
  modelTier: string
  systemPrompt: string
}

const STACK_DISPLAY: Record<string, { name: string; abbr: string; color: string; textClass: string }> = {
  universal: { name: "Universal", abbr: "U", color: "violet", textClass: "text-[var(--surface-violet-text)]" },
  ethereum:  { name: "Ethereum",  abbr: "Ξ", color: "blue",   textClass: "text-[var(--surface-info-text)]" },
  solana:    { name: "Solana",    abbr: "S", color: "green",  textClass: "text-[var(--surface-success-text)]" },
  tangle:    { name: "Tangle",    abbr: "T", color: "purple", textClass: "text-[var(--surface-violet-text)]" },
  "ai-sdk":  { name: "AI SDK",    abbr: "AI", color: "teal", textClass: "text-[var(--surface-teal-text)]" },
  rust:      { name: "Rust",      abbr: "Rs", color: "orange", textClass: "text-[var(--surface-orange-text)]" },
}

export function resolveEnvironment(env: EnvironmentEntry): EnvironmentOption {
  const display = STACK_DISPLAY[env.id]
  const name = display?.name ?? (env.id.length > 0 ? env.id.charAt(0).toUpperCase() + env.id.slice(1).replace(/-/g, " ") : "Unknown")
  const abbr = display?.abbr ?? (env.id.length > 0 ? env.id[0].toUpperCase() : "?")
  const color = display?.color ?? "slate"
  const textClass = display?.textClass ?? "text-[var(--text-muted)]"
  return {
    id: env.id,
    name,
    description: env.description ?? `${name} development environment`,
    icon: <span className={`${textClass} text-2xl font-bold`}>{abbr}</span>,
    color,
  }
}

const defaultEnvironments: EnvironmentOption[] = [
  { id: "node", name: "Node.js", description: "v20.x LTS with optimized runtime for asynchronous event-driven agents.", icon: <span className="text-[var(--code-success)] text-2xl font-bold">N</span>, color: "green" },
  { id: "python", name: "Python", description: "v3.11 pre-installed with PyTorch and common data science libraries.", icon: <span className="text-sky-400 text-2xl font-bold">Py</span>, color: "blue" },
  { id: "ubuntu", name: "Ubuntu", description: "Full 22.04 LTS terminal access for custom containerized workloads.", icon: <span className="text-orange-400 text-2xl font-bold">U</span>, color: "orange" },
]

const STEPS = ["Stack", "Resources", "Agent", "Review"]

const CPU_MIN = 0.5
const CPU_MAX = 8
const RAM_MIN = 2
const RAM_MAX = 32
const STORAGE_MIN = 20
const STORAGE_MAX = 512

function calcCost(cpu: number, ram: number): string {
  const cost = cpu * 0.045 + ram * 0.005
  return cost.toFixed(2)
}

const sectionIcon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-surface-soft)] border border-[var(--border-accent)] text-[var(--brand-cool)]"

export function ProvisioningWizard({
  environments: environmentsProp,
  onLoadEnvironments,
  onSubmit,
  onBack,
  className,
}: ProvisioningWizardProps) {
  const [envList, setEnvList] = React.useState<EnvironmentOption[]>(environmentsProp ?? defaultEnvironments)

  React.useEffect(() => {
    if (onLoadEnvironments) {
      onLoadEnvironments().then((entries) => setEnvList(entries.map(resolveEnvironment)))
    } else if (environmentsProp) {
      setEnvList(environmentsProp)
    }
  }, [onLoadEnvironments, environmentsProp])

  const environments = envList

  const [step, setStep] = React.useState(0)
  const [selectedEnv, setSelectedEnv] = React.useState(environments[0]?.id ?? "")
  const [cpuCores, setCpuCores] = React.useState(4)
  const [ramGB, setRamGB] = React.useState(16)
  const [storageGB, setStorageGB] = React.useState(128)
  const [modelTier, setModelTier] = React.useState("claude-sonnet")
  const [systemPrompt, setSystemPrompt] = React.useState("")

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else onSubmit?.({ environment: selectedEnv, cpuCores, ramGB, storageGB, modelTier, systemPrompt })
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
    else onBack?.()
  }

  const hourCost = calcCost(cpuCores, ramGB)

  return (
    <div className={cn("max-w-6xl mx-auto", className)}>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">Sandbox Provisioning</h1>
        <p className="text-[var(--text-muted)] max-w-2xl">
          Configure your high-performance orchestration environment. Select your stack, allocate resources, and prime your agent for deployment.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {STEPS.map((label, i) => (
          <div key={label} className="relative pt-5">
            <div className={cn("h-1 w-full rounded-full transition-colors", i <= step ? "bg-[var(--brand-cool)]" : "bg-[var(--depth-3)]")} />
            <span className={cn("absolute top-0 left-0 font-mono text-[10px] uppercase tracking-widest font-bold transition-colors", i <= step ? "text-[var(--brand-cool)]" : "text-[var(--text-muted)]")}>
              {String(i + 1).padStart(2, "0")} {label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: Steps */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          {/* Step 1: Environment */}
          <section className="bg-[var(--depth-2)] rounded-xl p-8 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-4 mb-8">
              <div className={sectionIcon}><Layers className="h-5 w-5" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Environment Selection</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedEnv(env.id)}
                  className={cn(
                    "group relative p-5 rounded-xl bg-[var(--depth-3)] cursor-pointer hover:bg-[var(--depth-4)] transition-all text-left border",
                    selectedEnv === env.id ? "border-[var(--border-accent)]" : "border-[var(--border-subtle)]",
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--depth-1)]">
                      {env.icon}
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedEnv === env.id ? "border-[var(--brand-cool)]" : "border-[var(--border-default)]")}>
                      {selectedEnv === env.id && <div className="w-2.5 h-2.5 bg-[var(--brand-cool)] rounded-full" />}
                    </div>
                  </div>
                  <h3 className="font-bold text-base mb-1 text-[var(--text-primary)]">{env.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{env.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Resources */}
          <section className="bg-[var(--depth-2)] rounded-xl p-8 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-4 mb-8">
              <div className={sectionIcon}><Cpu className="h-5 w-5" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Resource Allocation</h2>
            </div>
            <div className="space-y-8">
              {[
                { label: "Compute Cores (CPU)", value: cpuCores, setter: setCpuCores, min: CPU_MIN, max: CPU_MAX, step: 0.5, unit: "vCPUs" },
                { label: "Memory (RAM)", value: ramGB, setter: setRamGB, min: RAM_MIN, max: RAM_MAX, step: 1, unit: "GB" },
                { label: "Ephemeral Storage", value: storageGB, setter: setStorageGB, min: STORAGE_MIN, max: STORAGE_MAX, step: 8, unit: "GB" },
              ].map(({ label, value, setter, min, max, step: s, unit }) => (
                <div key={label} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</label>
                    <span className="text-2xl font-bold text-[var(--brand-cool)]">{value} <span className="text-xs text-[var(--text-muted)]">{unit}</span></span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={s}
                    value={value}
                    onChange={(e) => setter(+e.target.value)}
                    className="w-full h-2 bg-[var(--depth-1)] rounded-full appearance-none cursor-pointer accent-[var(--brand-cool)]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                    <span>{min} {unit}</span>
                    <span>{max} {unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Step 3: AI Agent */}
          <section className="bg-[var(--depth-2)] rounded-xl p-8 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-4 mb-8">
              <div className={sectionIcon}><Bot className="h-5 w-5" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">AI Agent Configuration</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-3">Model Tier</label>
                <select
                  value={modelTier}
                  onChange={(e) => setModelTier(e.target.value)}
                  className="w-full bg-[var(--depth-1)] border border-[var(--border-subtle)] rounded-xl h-12 px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-accent)] text-[var(--text-primary)]"
                >
                  <option value="llama-3-8b">Llama-3-8B-Instruct (Lightweight)</option>
                  <option value="mistral-7b">Mistral-7B-v0.2 (Efficient)</option>
                  <option value="claude-sonnet">Claude Sonnet 4.6 (Capable)</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-3">Initial System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full bg-[var(--depth-1)] border border-[var(--border-subtle)] rounded-xl p-5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border-accent)] h-40 resize-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  placeholder="Define the core persona of your agent..."
                />
              </div>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex justify-between items-center py-4">
            <button type="button" onClick={handleBack} className="px-8 py-3 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--depth-3)] transition-colors text-sm font-bold text-[var(--text-secondary)] flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="button" onClick={handleNext} className="px-10 py-3 bg-[var(--accent-surface-soft)] border border-[var(--border-accent)] text-[var(--accent-text)] font-bold rounded-xl hover:bg-[var(--accent-surface-strong)] active:scale-95 transition-all flex items-center gap-2 group">
              {step < STEPS.length - 1 ? "Continue" : "Launch Sandbox"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right: Cost estimator + terminal preview */}
        <div className="col-span-12 xl:col-span-4 sticky top-24 space-y-6">
          {/* Terminal preview */}
          <div className="bg-[var(--depth-2)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            <div className="bg-[var(--depth-1)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between">
              <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-tighter">config_stream.sh</div>
            </div>
            <div className="p-6 font-mono text-xs space-y-3 min-h-[280px]">
              <div className="text-[var(--code-success)]">$ tangle-cli provision --new</div>
              <div className="text-[var(--text-muted)]">Initializing handshake...</div>
              <div className="text-[var(--text-secondary)]"><span className="text-[var(--brand-cool)]">✓</span> Platform: <span className="text-[var(--text-primary)]">{environments.find((e) => e.id === selectedEnv)?.name ?? "Node.js"}</span></div>
              <div className="text-[var(--text-secondary)]"><span className="text-[var(--brand-cool)]">✓</span> Compute: <span className="text-[var(--text-primary)]">{cpuCores} vCPUs</span></div>
              <div className="text-[var(--text-secondary)]"><span className="text-[var(--brand-cool)]">✓</span> Memory: <span className="text-[var(--text-primary)]">{ramGB}GB</span></div>
              <div className="text-[var(--text-secondary)]"><span className="text-[var(--brand-cool)]">✓</span> Disk: <span className="text-[var(--text-primary)]">{storageGB}GB NVMe</span></div>
              <div className="pt-4 flex items-center gap-2">
                <div className="w-2 h-4 bg-[var(--brand-cool)] animate-pulse" />
                <span className="text-[var(--text-muted)]">Ready for review...</span>
              </div>
            </div>
          </div>

          {/* Cost card */}
          <div className="p-6 rounded-xl bg-[var(--depth-3)] border border-[var(--border-accent)]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-[var(--text-secondary)]">Estimated Run Cost</span>
              <Info className="h-4 w-4 text-[var(--brand-cool)]" />
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-[var(--text-primary)]">${hourCost}</span>
              <span className="text-[var(--text-muted)] text-sm">/ hour</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <span>Compute</span>
                <span className="text-[var(--text-secondary)]">${(cpuCores * 0.045).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <span>Memory</span>
                <span className="text-[var(--text-secondary)]">${(ramGB * 0.005).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
