"use client"

import * as React from "react"
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

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

const STACK_DISPLAY: Record<string, { name: string; abbr: string; color: string; textClass: string; bgClass: string }> = {
  universal: { name: "Universal", abbr: "U", color: "violet", textClass: "text-violet-400", bgClass: "bg-violet-500/10" },
  ethereum: { name: "Ethereum", abbr: "Ξ", color: "blue", textClass: "text-blue-400", bgClass: "bg-blue-500/10" },
  solana: { name: "Solana", abbr: "S", color: "green", textClass: "text-green-400", bgClass: "bg-green-500/10" },
  tangle: { name: "Tangle", abbr: "T", color: "purple", textClass: "text-purple-400", bgClass: "bg-purple-500/10" },
  "ai-sdk": { name: "AI SDK", abbr: "AI", color: "cyan", textClass: "text-cyan-400", bgClass: "bg-cyan-500/10" },
  rust: { name: "Rust", abbr: "Rs", color: "orange", textClass: "text-orange-400", bgClass: "bg-orange-500/10" },
}

export function resolveEnvironment(env: { id: string; description?: string }): EnvironmentOption {
  const display = STACK_DISPLAY[env.id]
  const name = display?.name ?? (env.id.length > 0 ? env.id.charAt(0).toUpperCase() + env.id.slice(1).replace(/-/g, " ") : "Unknown")
  const abbr = display?.abbr ?? (env.id.length > 0 ? env.id[0].toUpperCase() : "?")
  const color = display?.color ?? "slate"
  const textClass = display?.textClass ?? "text-slate-400"
  return {
    id: env.id,
    name,
    description: env.description ?? `${name} development environment`,
    icon: <span className={`${textClass} text-2xl font-bold`}>{abbr}</span>,
    color,
  }
}

const COLOR_BG_CLASS: Record<string, string> = {
  green: "bg-green-500/10",
  blue: "bg-blue-500/10",
  orange: "bg-orange-500/10",
  violet: "bg-violet-500/10",
  purple: "bg-purple-500/10",
  cyan: "bg-cyan-500/10",
  slate: "bg-slate-500/10",
}

const defaultEnvironments: EnvironmentOption[] = [
  { id: "node", name: "Node.js", description: "v20.x LTS with optimized runtime for asynchronous event-driven agents.", icon: <span className="text-green-400 text-2xl font-bold">N</span>, color: "green" },
  { id: "python", name: "Python", description: "v3.11 pre-installed with PyTorch and common data science libraries.", icon: <span className="text-blue-400 text-2xl font-bold">Py</span>, color: "blue" },
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

export function ProvisioningWizard({
  environments: environmentsProp,
  onLoadEnvironments,
  onSubmit,
  onBack,
  className,
}: ProvisioningWizardProps) {
  const [environments, setEnvironments] = React.useState<EnvironmentOption[]>(
    environmentsProp ?? defaultEnvironments,
  )
  const [loading, setLoading] = React.useState(!environmentsProp && !!onLoadEnvironments)
  const [step, setStep] = React.useState(0)
  const [selectedEnv, setSelectedEnv] = React.useState(environments[0]?.id ?? "")

  React.useEffect(() => {
    if (environmentsProp || !onLoadEnvironments) return

    let cancelled = false

    onLoadEnvironments()
      .then((entries) => {
        if (cancelled || !entries?.length) return
        const resolved = entries.map(resolveEnvironment)
        setEnvironments(resolved)
        setSelectedEnv(resolved[0].id)
      })
      .catch(() => {
        // Keep defaultEnvironments on failure
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [onLoadEnvironments, environmentsProp])
  const [cpuCores, setCpuCores] = React.useState(4)
  const [ramGB, setRamGB] = React.useState(16)
  const [storageGB, setStorageGB] = React.useState(128)
  const [modelTier, setModelTier] = React.useState("llama-3-8b")
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
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Sandbox Provisioning</h1>
        <p className="text-on-surface-variant max-w-2xl">
          Configure your high-performance orchestration environment. Select your stack, allocate resources, and prime your agent for deployment.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="grid grid-cols-4 gap-4 mb-12">
        {STEPS.map((label, i) => (
          <div key={label} className="relative pt-4">
            <div className={cn("h-1 w-full rounded-full", i <= step ? "bg-md3-primary" : i === step + 1 ? "bg-md3-primary/40" : "bg-surface-container-highest")} />
            <span className={cn("absolute top-0 left-0 font-mono text-[10px] uppercase tracking-widest font-bold", i <= step ? "text-md3-primary" : "text-surface-variant")}>
              {String(i + 1).padStart(2, "0")} {label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: Steps */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
          {/* Step 1: Environment */}
          <section className="bg-surface-container-low rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-lg bg-md3-primary/10 flex items-center justify-center text-md3-primary">
                <MaterialIcon name="layers" />
              </div>
              <h2 className="text-xl font-bold">Environment Selection</h2>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setSelectedEnv(env.id)}
                    className={cn(
                      "group relative p-6 rounded-xl bg-surface-container cursor-pointer hover:bg-surface-container-high transition-all text-left",
                      selectedEnv === env.id ? "border border-md3-primary/20" : "border border-outline-variant/10",
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", COLOR_BG_CLASS[env.color] ?? "bg-slate-500/10")}>
                        {env.icon}
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedEnv === env.id ? "border-md3-primary" : "border-outline-variant/30")}>
                        {selectedEnv === env.id && <div className="w-2.5 h-2.5 bg-md3-primary rounded-full" />}
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{env.name}</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{env.description}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Step 2: Resources */}
          <section className="bg-surface-container-low rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-lg bg-md3-primary/10 flex items-center justify-center text-md3-primary">
                <MaterialIcon name="memory" />
              </div>
              <h2 className="text-xl font-bold">Resource Allocation</h2>
            </div>
            <div className="space-y-10">
              {/* CPU */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Compute Cores (CPU)</label>
                  <span className="text-2xl font-bold text-md3-primary">{cpuCores} <span className="text-xs text-on-surface-variant">vCPUs</span></span>
                </div>
                <input
                  type="range"
                  min={CPU_MIN}
                  max={CPU_MAX}
                  step={0.5}
                  value={cpuCores}
                  onChange={(e) => setCpuCores(+e.target.value)}
                  className="w-full h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-surface-variant">
                  <span>{CPU_MIN} vCPU</span>
                  <span>{CPU_MAX} vCPU</span>
                </div>
              </div>
              {/* RAM */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Memory (RAM)</label>
                  <span className="text-2xl font-bold text-md3-primary">{ramGB} <span className="text-xs text-on-surface-variant">GB</span></span>
                </div>
                <input
                  type="range"
                  min={RAM_MIN}
                  max={RAM_MAX}
                  step={1}
                  value={ramGB}
                  onChange={(e) => setRamGB(+e.target.value)}
                  className="w-full h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-surface-variant">
                  <span>{RAM_MIN} GB</span>
                  <span>{RAM_MAX} GB</span>
                </div>
              </div>
              {/* Storage */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Ephemeral Storage</label>
                  <span className="text-2xl font-bold text-md3-primary">{storageGB} <span className="text-xs text-on-surface-variant">GB</span></span>
                </div>
                <input
                  type="range"
                  min={STORAGE_MIN}
                  max={STORAGE_MAX}
                  step={8}
                  value={storageGB}
                  onChange={(e) => setStorageGB(+e.target.value)}
                  className="w-full h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-surface-variant">
                  <span>{STORAGE_MIN} GB</span>
                  <span>{STORAGE_MAX} GB</span>
                </div>
              </div>
            </div>
          </section>

          {/* Step 3: AI Agent */}
          <section className="bg-surface-container-low rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-lg bg-md3-primary/10 flex items-center justify-center text-md3-primary">
                <MaterialIcon name="smart_toy" />
              </div>
              <h2 className="text-xl font-bold">AI Agent Configuration</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-on-surface-variant mb-3">Model Tier</label>
                <select
                  value={modelTier}
                  onChange={(e) => setModelTier(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-xl h-12 px-4 font-mono text-sm focus:ring-2 focus:ring-md3-primary/40 text-on-surface"
                >
                  <option value="llama-3-8b">Llama-3-8B-Instruct (Lightweight)</option>
                  <option value="mistral-7b">Mistral-7B-v0.2 (Efficient)</option>
                  <option value="claude-sonnet">Claude Sonnet 4.6 (Capable)</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-widest text-on-surface-variant mb-3">Initial System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full bg-surface-container-lowest border-none rounded-xl p-6 font-mono text-sm focus:ring-2 focus:ring-md3-primary/40 h-40 resize-none text-primary-fixed-dim"
                  placeholder="Define the core persona of your agent..."
                />
              </div>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex justify-between items-center py-4">
            <button type="button" onClick={handleBack} className="px-8 py-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors text-sm font-bold flex items-center gap-2">
              <MaterialIcon name="arrow_back" className="text-lg" />
              Back
            </button>
            <button type="button" onClick={handleNext} className="px-10 py-3 bg-gradient-to-br from-md3-primary to-primary-container text-on-primary font-bold rounded-xl shadow-lg shadow-md3-primary/20 flex items-center gap-2 group">
              {step < STEPS.length - 1 ? "Continue to Review" : "Launch Sandbox"}
              <MaterialIcon name="arrow_forward" className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right: Cost estimator + terminal preview */}
        <div className="col-span-12 xl:col-span-4 sticky top-24 space-y-8">
          {/* Terminal preview */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-surface-container-high px-4 py-3 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-tighter">config_stream.sh</div>
              <div />
            </div>
            <div className="p-6 font-mono text-xs space-y-3 min-h-[300px]">
              <div className="text-green-400">$ tangle-cli provision --new</div>
              <div className="text-slate-500">Initializing handshake...</div>
              <div className="text-slate-300"><span className="text-violet-400">&#10003;</span> Platform: <span className="text-white">{environments.find((e) => e.id === selectedEnv)?.name ?? selectedEnv}</span></div>
              <div className="text-slate-300"><span className="text-violet-400">&#10003;</span> Compute: <span className="text-white">{cpuCores} vCPUs</span></div>
              <div className="text-slate-300"><span className="text-violet-400">&#10003;</span> Memory: <span className="text-white">{ramGB}GB</span></div>
              <div className="text-slate-300"><span className="text-violet-400">&#10003;</span> Disk: <span className="text-white">{storageGB}GB NVMe</span></div>
              <div className="pt-4 flex items-center gap-2">
                <div className="w-2 h-4 bg-md3-primary animate-pulse" />
                <span className="text-slate-500">Ready for review...</span>
              </div>
            </div>
          </div>

          {/* Cost card */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 backdrop-blur-[20px]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-on-surface-variant">Estimated Run Cost</span>
              <MaterialIcon name="info" className="text-violet-400" />
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-white">${hourCost}</span>
              <span className="text-on-surface-variant text-sm">/ hour</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <span>Compute</span>
                <span className="text-slate-300">${(cpuCores * 0.045).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <span>Memory</span>
                <span className="text-slate-300">${(ramGB * 0.005).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
