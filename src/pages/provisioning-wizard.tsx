"use client"

import * as React from "react"
import { ArrowLeft, Layers, Cpu, Bot, Info, Loader2, Settings, Plus, Trash2 } from "lucide-react"
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
  variant?: "flat" | "multistep"
}

export interface ProvisioningConfig {
  environment: string
  cpuCores: number
  ramGB: number
  storageGB: number
  modelTier: string
  systemPrompt: string
  name: string
  gitUrl: string
  envVars: { key: string; value: string }[]
  driver: "docker" | "firecracker" | "tangle"
  bare: boolean
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
  const textClass = display?.textClass ?? "text-muted-foreground"
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
  variant = "flat",
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

  const [selectedEnv, setSelectedEnv] = React.useState(environments[0]?.id ?? "")
  const [cpuCores, setCpuCores] = React.useState(4)
  const [ramGB, setRamGB] = React.useState(16)
  const [storageGB, setStorageGB] = React.useState(128)
  const [modelTier, setModelTier] = React.useState("claude-sonnet")
  const [systemPrompt, setSystemPrompt] = React.useState("")
  const [name, setName] = React.useState("")
  const [gitUrl, setGitUrl] = React.useState("")
  const [envVars, setEnvVars] = React.useState<{key: string, value: string}[]>([{ key: "", value: "" }])
  const [driver, setDriver] = React.useState<"docker" | "firecracker" | "tangle">("docker")
  const [bare, setBare] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  const [currentStep, setCurrentStep] = React.useState(1)
  const isMultistep = variant === "multistep"

  const [isDeploying, setIsDeploying] = React.useState(false)

  const handleDeploy = () => {
    setIsDeploying(true)
    onSubmit?.({ environment: selectedEnv, cpuCores, ramGB, storageGB, modelTier, systemPrompt, name, gitUrl, envVars: envVars.filter(e => e.key.trim() !== ''), driver, bare })
  }

  const applyPreset = (cpu: number, ram: number, storage: number) => {
    setCpuCores(cpu)
    setRamGB(ram)
    setStorageGB(storage)
  }

  const hourCost = calcCost(cpuCores, ramGB)

  return (
    <div className={cn("max-w-6xl mx-auto flex flex-col", className)}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4 shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted/50 transition-colors text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">Sandbox Provisioning</h1>
          <p className="text-muted-foreground text-sm">
            Select your stack, allocate resources, and configure your agent.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: Configuration Form */}
        <div className="col-span-12 xl:col-span-8 flex flex-col min-h-0">
          {isMultistep && (
            <div className="flex items-center gap-2 mb-4 glass-panel p-3 rounded-2xl mx-auto max-w-2xl justify-between shrink-0">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors shrink-0", currentStep === s ? "bg-primary text-primary-foreground" : currentStep > s ? "bg-primary/40 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {s}
                  </div>
                  <span className={cn("ml-2 sm:ml-3 font-bold text-sm tracking-tight hidden sm:inline", currentStep === s ? "text-foreground" : currentStep > s ? "text-primary/60" : "text-muted-foreground")}>
                    {s === 1 && "Environment"}
                    {s === 2 && "Resources"}
                    {s === 3 && "AI Agent"}
                  </span>
                  {s < 3 && <div className={cn("w-4 sm:w-8 h-px mx-2 sm:mx-4 transition-colors", currentStep > s ? "bg-primary/40" : "bg-border")} />}
                </div>
              ))}
            </div>
          )}

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {(!isMultistep || currentStep === 1) && (
          <React.Fragment>
          {/* Section 1: Environment */}
          <section className="glass-panel rounded-[24px] p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent glow-primary"><Layers className="h-5 w-5" /></div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Environment Selection</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedEnv(env.id)}
                  className={cn(
                    "group relative p-4 rounded-[16px] transition-all text-left overflow-hidden border border-transparent",
                    selectedEnv === env.id
                      ? "glass-panel-heavy border-accent glow-primary"
                      : "glass-panel hover:border-[var(--glass-border-color)]",
                  )}
                >
                  {selectedEnv === env.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none" />
                  )}
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/50 border border-border shadow-inner">
                      {env.icon}
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", selectedEnv === env.id ? "border-accent bg-accent/20" : "border-border")}>
                      {selectedEnv === env.id && <div className="w-2.5 h-2.5 bg-accent rounded-full animate-in zoom-in" />}
                    </div>
                  </div>
                  <h3 className="font-bold text-sm mb-0.5 text-foreground relative z-10">{env.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed relative z-10">{env.description}</p>
                </button>
              ))}
            </div>
          </section>
          </React.Fragment>
          )}

          {(!isMultistep || currentStep === 2) && (
          <React.Fragment>
          {/* Section 2: Resources */}
          <section className="glass-panel rounded-[24px] p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent glow-primary"><Cpu className="h-5 w-5" /></div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Resource Allocation</h2>
            </div>

            <div className="mb-6">
              <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Compute Presets</label>
              <div className="grid grid-cols-3 gap-3">
                <button type="button" onClick={() => applyPreset(2, 4, 50)} className={cn("p-3 rounded-[14px] transition-all text-center group", cpuCores === 2 && ramGB === 4 && storageGB === 50 ? "glass-panel-heavy border-accent glow-primary" : "glass-panel hover:border-[var(--glass-border-color)]")}>
                  <div className={cn("font-bold text-sm transition-colors", cpuCores === 2 && ramGB === 4 && storageGB === 50 ? "text-accent" : "text-foreground")}>Lightweight</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">2C / 4G / 50G</div>
                </button>
                <button type="button" onClick={() => applyPreset(4, 16, 128)} className={cn("p-3 rounded-[14px] transition-all text-center group", cpuCores === 4 && ramGB === 16 && storageGB === 128 ? "glass-panel-heavy border-accent glow-primary" : "glass-panel hover:border-[var(--glass-border-color)]")}>
                  <div className={cn("font-bold text-sm transition-colors", cpuCores === 4 && ramGB === 16 && storageGB === 128 ? "text-accent" : "text-foreground")}>Standard</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">4C / 16G / 128G</div>
                </button>
                <button type="button" onClick={() => applyPreset(8, 32, 256)} className={cn("p-3 rounded-[14px] transition-all text-center group", cpuCores === 8 && ramGB === 32 && storageGB === 256 ? "glass-panel-heavy border-accent glow-primary" : "glass-panel hover:border-[var(--glass-border-color)]")}>
                  <div className={cn("font-bold text-sm transition-colors", cpuCores === 8 && ramGB === 32 && storageGB === 256 ? "text-accent" : "text-foreground")}>Performance</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">8C / 32G / 256G</div>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {[
                { label: "Compute Cores (CPU)", value: cpuCores, setter: setCpuCores, min: CPU_MIN, max: CPU_MAX, step: 0.5, unit: "vCPUs" },
                { label: "Memory (RAM)", value: ramGB, setter: setRamGB, min: RAM_MIN, max: RAM_MAX, step: 1, unit: "GB" },
                { label: "Ephemeral Storage", value: storageGB, setter: setStorageGB, min: STORAGE_MIN, max: STORAGE_MAX, step: 8, unit: "GB" },
              ].map(({ label, value, setter, min, max, step: s, unit }) => (
                <div key={label}>
                  <div className="flex justify-between items-end border-b border-border pb-1.5 mb-2">
                    <label className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
                    <span className="text-xl font-bold text-foreground tracking-tight">{value} <span className="text-xs text-accent/80 ml-1">{unit}</span></span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={s}
                    value={value}
                    onChange={(e) => setter(+e.target.value)}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60 mt-1">
                    <span>{min}{unit}</span>
                    <span>{max}{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          </React.Fragment>
          )}

          {(!isMultistep || currentStep === 3) && (
          <React.Fragment>
          {/* Section 3: AI Agent */}
          <section className="glass-panel rounded-[24px] p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent glow-primary"><Bot className="h-5 w-5" /></div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">AI Agent Capability</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Model Engine</label>
                <select
                  value={modelTier}
                  onChange={(e) => setModelTier(e.target.value)}
                  className="w-full glass-panel rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent appearance-none"
                >
                  <option value="llama-3-8b" className="bg-gray-900">Llama-3-8B-Instruct (Lightweight)</option>
                  <option value="mistral-7b" className="bg-gray-900">Mistral-7B-v0.2 (Efficient)</option>
                  <option value="claude-sonnet" className="bg-gray-900">Claude Sonnet 4.6 (Highly Capable)</option>
                </select>
              </div>
              <div>
                <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Core Directives (System Prompt)</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full glass-panel rounded-xl p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-32 resize-none placeholder:text-muted-foreground"
                  placeholder="Define the autonomous directives or operational boundaries..."
                />
              </div>

              {/* Advanced Options Toggle Section */}
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors text-sm font-bold focus:outline-none"
                >
                  <Settings className="w-4 h-4" />
                  {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
                </button>

                {showAdvanced && (
                  <div className="mt-6 space-y-5 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Workspace Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full glass-panel rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-muted-foreground"
                          placeholder="my-cool-sandbox"
                        />
                      </div>
                      <div>
                        <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Virtualization Driver</label>
                        <select
                          value={driver}
                          onChange={(e) => setDriver(e.target.value as any)}
                          className="w-full glass-panel rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent appearance-none"
                        >
                          <option value="docker" className="bg-gray-900">Docker container (Default)</option>
                          <option value="firecracker" className="bg-gray-900">Firecracker microVM (Secure)</option>
                          <option value="tangle" className="bg-gray-900">Tangle Distributed Node</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Git Repository URL</label>
                      <input
                        type="text"
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                        className="w-full glass-panel rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-muted-foreground"
                        placeholder="https://github.com/my-org/my-repo.git"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">Environment Variables</label>
                        <button type="button" onClick={() => setEnvVars([...envVars, {key: '', value: ''}])} className="flex items-center gap-1 text-xs text-accent hover:text-accent-deep transition-colors font-bold">
                          <Plus className="h-3 w-3" /> Add Var
                        </button>
                      </div>
                      <div className="space-y-2">
                        {envVars.map((env, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={env.key}
                              onChange={(e) => setEnvVars(envVars.map((v, idx) => idx === i ? { ...v, key: e.target.value } : v))}
                              className="flex-1 glass-panel rounded-xl h-10 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted-foreground"
                              placeholder="API_KEY"
                            />
                            <input
                              type="password"
                              value={env.value}
                              onChange={(e) => setEnvVars(envVars.map((v, idx) => idx === i ? { ...v, value: e.target.value } : v))}
                              className="flex-[2] glass-panel rounded-xl h-10 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted-foreground"
                              placeholder="sk-xxxxxxxxxxx"
                            />
                            <button type="button" onClick={() => setEnvVars(envVars.filter((_, idx) => idx !== i))} className="h-10 w-10 flex items-center justify-center shrink-0 rounded-xl glass-panel text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {envVars.length === 0 && (
                          <div className="text-center p-3 glass-panel rounded-xl text-muted-foreground/60 text-sm italic">No environment variables set</div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center shrink-0">
                          <input type="checkbox" className="sr-only peer" checked={bare} onChange={(e) => setBare(e.target.checked)} />
                          <div className="w-10 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent hover:bg-white/20 transition-colors"></div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-foreground mb-0.5 group-hover:text-accent transition-colors">Bare Mode</div>
                          <div className="text-xs text-muted-foreground">Start as a raw container without an embedded AI Agent backend.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          </React.Fragment>
          )}
          </div>
        </div>

        {/* Right: Cost estimator + terminal preview */}
        <div className="col-span-12 xl:col-span-4 sticky top-4 space-y-4">
          {/* Terminal preview */}
          <div className="glass-panel-heavy rounded-[24px] overflow-hidden shadow-2xl relative">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(173,163,255,0.05)_0,transparent_100%)] pointer-events-none" />
            <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-[#ff5f56]/80" />
                <div className="h-3 w-3 rounded-full bg-[#ffbd2e]/80" />
                <div className="h-3 w-3 rounded-full bg-[#27c93f]/80" />
              </div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest ml-2 border-l border-border pl-3">deploy_sequence.sh</div>
            </div>
            <div className="p-5 font-mono text-xs space-y-3 min-h-[240px] relative z-10 text-[13px]">
              <div className="text-green-400">root@tangle:~# <span className="text-foreground/80">tangle-cli provision --new</span></div>
              <div className="text-muted-foreground/70">Initializing deployment handshake...</div>
              <div className="text-foreground/70"><span className="text-accent mr-2">✓</span> Bound Platform: <span className="text-foreground font-bold">{environments.find((e) => e.id === selectedEnv)?.name ?? "Node.js"}</span></div>
              <div className="text-foreground/70"><span className="text-accent mr-2">✓</span> Allocation CPU: <span className="text-foreground font-bold">{cpuCores} Cores</span></div>
              <div className="text-foreground/70"><span className="text-accent mr-2">✓</span> Allocation RAM: <span className="text-foreground font-bold">{ramGB}GB</span></div>
              <div className="text-foreground/70"><span className="text-accent mr-2">✓</span> Mounted Storage: <span className="text-foreground font-bold">{storageGB}GB NVMe</span></div>
              <div className="pt-3 flex items-center gap-3">
                <div className="w-2 h-4 bg-accent animate-pulse" />
                <span className="text-muted-foreground">Awaiting user confirmation...</span>
              </div>
            </div>
          </div>

          {/* Cost card */}
          <div className="p-6 rounded-2xl bg-accent/5 backdrop-blur-md border border-accent/20 shadow-[0_0_30px_rgba(173,163,255,0.1)] relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/20 blur-[50px] rounded-full" />

            <div className="flex justify-between items-center mb-4 relative z-10">
              <span className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">Run Cost</span>
              <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center border border-border">
                <Info className="h-3.5 w-3.5 text-accent" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-5 relative z-10">
              <span className="text-4xl font-black text-foreground tracking-tighter">${hourCost}</span>
              <span className="text-muted-foreground text-sm font-bold">/ hour</span>
            </div>
            <div className="space-y-2 relative z-10 glass-panel rounded-xl p-3 border border-border">
              <div className="flex justify-between text-xs font-mono tracking-widest text-muted-foreground">
                <span>COMPUTE</span>
                <span className="text-foreground">${(cpuCores * 0.045).toFixed(2)}/h</span>
              </div>
              <div className="flex justify-between text-xs font-mono tracking-widest text-muted-foreground">
                <span>MEMORY</span>
                <span className="text-foreground/80">${(ramGB * 0.005).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="space-y-3">
            {isMultistep ? (
              <>
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s + 1)}
                    className="w-full relative overflow-hidden h-12 bg-accent/10 text-accent font-extrabold text-sm rounded-2xl border border-accent/20 hover:bg-accent/20 transition-colors shadow-sm shadow-accent/10"
                  >
                    Continue to {currentStep === 1 ? "Resources" : "Agent Config"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={isDeploying || !selectedEnv}
                    className="w-full relative overflow-hidden h-12 bg-gradient-to-r from-accent to-accent-deep text-white font-extrabold text-sm rounded-2xl tracking-wide shadow-[0_0_20px_rgba(130,99,255,0.2)] disabled:opacity-50 transition-transform active:scale-[0.98]"
                  >
                    {isDeploying ? (
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deploying...
                      </span>
                    ) : (
                      <span className="relative z-10">Deploy Workspace</span>
                    )}
                    <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    className="w-full h-10 glass-panel text-foreground/70 font-bold text-sm rounded-2xl hover:text-foreground hover:border-[var(--glass-border-color)] transition-colors"
                  >
                    Back
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !selectedEnv}
                className="w-full relative overflow-hidden h-12 bg-gradient-to-r from-accent to-accent-deep text-white font-extrabold text-sm rounded-2xl tracking-wide shadow-[0_0_20px_rgba(130,99,255,0.2)] disabled:opacity-50 transition-transform active:scale-[0.98]"
              >
                {isDeploying ? (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Spinning up environment...
                  </span>
                ) : (
                  <span className="relative z-10">Deploy Workspace</span>
                )}
                <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
