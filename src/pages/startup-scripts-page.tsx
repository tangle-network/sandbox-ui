"use client"

import * as React from "react"
import {
  Play,
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  Power,
  PowerOff,
  Shield,
  Terminal,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  Cpu,
  MemoryStick,
  Layers,
} from "lucide-react"
import { cn } from "../lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog"
import { InfoPanel } from "../dashboard/info-panel"

export type ScriptType = "bash" | "python" | "node" | "ruby" | "custom"

export interface StartupScript {
  id: string
  name: string
  description: string
  scriptType: ScriptType
  content: string
  environments: string[]
  minCpuCores: number | null
  minRamGB: number | null
  runOrder: number
  timeoutSeconds: number
  continueOnFailure: boolean
  runAsRoot: boolean
  injectSecrets: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface StartupScriptFormData {
  name: string
  description: string
  scriptType: ScriptType
  content: string
  environments: string[]
  minCpuCores: number | null
  minRamGB: number | null
  runOrder: number
  timeoutSeconds: number
  continueOnFailure: boolean
  runAsRoot: boolean
  injectSecrets: string[]
  enabled: boolean
}

export interface StartupScriptsApiClient {
  listScripts: () => Promise<StartupScript[]>
  createScript: (data: StartupScriptFormData) => Promise<StartupScript>
  updateScript: (id: string, data: Partial<StartupScriptFormData>) => Promise<StartupScript>
  deleteScript: (id: string) => Promise<void>
  toggleScript: (id: string) => Promise<StartupScript>
  listSecrets?: () => Promise<{ name: string }[]>
  listEnvironments?: () => Promise<{ id: string; name?: string }[]>
}

export interface StartupScriptsPageProps {
  apiClient: StartupScriptsApiClient
  className?: string
}

const SCRIPT_TYPE_META: Record<ScriptType, { label: string; ext: string; interpreter: string; template: string }> = {
  bash: {
    label: "Bash",
    ext: "sh",
    interpreter: "bash",
    template: "#!/bin/bash\nset -e\n\n# Your startup script here\n",
  },
  python: {
    label: "Python",
    ext: "py",
    interpreter: "python3",
    template: "#!/usr/bin/env python3\nimport os\nimport subprocess\n\n# Your startup script here\n",
  },
  node: {
    label: "Node.js",
    ext: "js",
    interpreter: "node",
    template: "#!/usr/bin/env node\nconst { execSync } = require('child_process');\n\n// Your startup script here\n",
  },
  ruby: {
    label: "Ruby",
    ext: "rb",
    interpreter: "ruby",
    template: "#!/usr/bin/env ruby\n\n# Your startup script here\n",
  },
  custom: {
    label: "Custom",
    ext: "sh",
    interpreter: "sh",
    template: "#!/bin/sh\n\n# Specify your interpreter in the shebang line above\n",
  },
}

interface ScriptTemplate {
  name: string
  description: string
  scriptType: ScriptType
  content: string
  injectSecrets: string[]
}

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    name: "Install Claude Code",
    description: "Install and authenticate Claude Code CLI",
    scriptType: "bash",
    content: `#!/bin/bash
set -e

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Authenticate if API key secret is available
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Claude Code installed and API key configured"
fi`,
    injectSecrets: ["ANTHROPIC_API_KEY"],
  },
  {
    name: "Git Clone & Setup",
    description: "Clone a repo, install dependencies, and run setup",
    scriptType: "bash",
    content: `#!/bin/bash
set -e

REPO_URL="\${GIT_REPO_URL:-https://github.com/your-org/your-repo.git}"
BRANCH="\${GIT_BRANCH:-main}"

cd /home/agent
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" workspace
cd workspace

# Detect and install dependencies
if [ -f "package.json" ]; then
  npm install
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "Cargo.toml" ]; then
  cargo fetch
elif [ -f "go.mod" ]; then
  go mod download
fi

echo "Repository cloned and dependencies installed"`,
    injectSecrets: ["GITHUB_TOKEN"],
  },
  {
    name: "Python Environment",
    description: "Create a virtual environment with common packages",
    scriptType: "python",
    content: `#!/usr/bin/env python3
import subprocess
import sys

# Create and activate virtual environment
subprocess.run([sys.executable, "-m", "venv", "/home/agent/.venv"], check=True)

# Install common packages
packages = [
    "requests",
    "httpx",
    "python-dotenv",
    "pydantic",
]

subprocess.run(
    ["/home/agent/.venv/bin/pip", "install", "--quiet"] + packages,
    check=True,
)

print(f"Python venv created with {len(packages)} packages")`,
    injectSecrets: [],
  },
  {
    name: "SSH Key Setup",
    description: "Configure SSH keys for Git access",
    scriptType: "bash",
    content: `#!/bin/bash
set -e

mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Write deploy key if secret is available
if [ -n "$SSH_PRIVATE_KEY" ]; then
  echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
  echo "SSH key configured for Git access"
else
  echo "No SSH_PRIVATE_KEY secret found, skipping"
fi`,
    injectSecrets: ["SSH_PRIVATE_KEY"],
  },
  {
    name: "Node.js Project Bootstrap",
    description: "Initialize a new Node.js project with TypeScript",
    scriptType: "node",
    content: `#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = '/home/agent/workspace';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
process.chdir(dir);

if (!fs.existsSync('package.json')) {
  execSync('npm init -y', { stdio: 'inherit' });
  execSync('npm install typescript tsx @types/node --save-dev', { stdio: 'inherit' });
  execSync('npx tsc --init --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist', { stdio: 'inherit' });
  console.log('Node.js + TypeScript project initialized');
} else {
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed');
}`,
    injectSecrets: [],
  },
]

function makeDefaultFormData(scriptType: ScriptType = "bash"): StartupScriptFormData {
  return {
    name: "",
    description: "",
    scriptType,
    content: SCRIPT_TYPE_META[scriptType].template,
    environments: [],
    minCpuCores: null,
    minRamGB: null,
    runOrder: 100,
    timeoutSeconds: 300,
    continueOnFailure: false,
    runAsRoot: false,
    injectSecrets: [],
    enabled: true,
  }
}

export function StartupScriptsPage({ apiClient, className }: StartupScriptsPageProps) {
  const [scripts, setScripts] = React.useState<StartupScript[]>([])
  const [secrets, setSecrets] = React.useState<{ name: string }[]>([])
  const [environments, setEnvironments] = React.useState<{ id: string; name?: string }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Dialog state — single dialog with step-based content
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [dialogStep, setDialogStep] = React.useState<"picker" | "form">("picker")
  // Tracks transition direction: "forward" = picker→form, "back" = form→picker
  const [transitionDir, setTransitionDir] = React.useState<"forward" | "back">("forward")
  // Key forces remount to re-trigger CSS animation on step change
  const [stepKey, setStepKey] = React.useState(0)
  const [editingScript, setEditingScript] = React.useState<StartupScript | null>(null)
  const [formData, setFormData] = React.useState<StartupScriptFormData>(makeDefaultFormData())
  const [isSaving, setIsSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [showConditions, setShowConditions] = React.useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = React.useState<StartupScript | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const apiRef = React.useRef(apiClient)
  apiRef.current = apiClient

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [scriptData, secretData, envData] = await Promise.all([
        apiRef.current.listScripts(),
        apiRef.current.listSecrets?.() ?? Promise.resolve([]),
        apiRef.current.listEnvironments?.() ?? Promise.resolve([]),
      ])
      setScripts(scriptData)
      setSecrets(secretData)
      setEnvironments(envData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load startup scripts")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  const openCreate = () => {
    setEditingScript(null)
    setFormData(makeDefaultFormData())
    setFormError(null)
    setShowConditions(false)
    setDialogStep("picker")
    setIsDialogOpen(true)
  }

  const goToStep = (step: "picker" | "form") => {
    setTransitionDir(step === "form" ? "forward" : "back")
    setStepKey((k) => k + 1)
    setDialogStep(step)
  }

  const openBlankScript = (scriptType: ScriptType = "bash") => {
    setEditingScript(null)
    setFormData(makeDefaultFormData(scriptType))
    setFormError(null)
    setShowConditions(false)
    goToStep("form")
  }

  const openFromTemplate = (template: ScriptTemplate) => {
    setEditingScript(null)
    setFormData({
      ...makeDefaultFormData(template.scriptType),
      name: template.name,
      description: template.description,
      content: template.content,
      injectSecrets: template.injectSecrets.filter((s) =>
        secrets.some((sec) => sec.name === s),
      ),
    })
    setFormError(null)
    setShowConditions(false)
    goToStep("form")
  }

  const openEdit = (script: StartupScript) => {
    setEditingScript(script)
    setFormData({
      name: script.name,
      description: script.description,
      scriptType: script.scriptType ?? "bash",
      content: script.content,
      environments: script.environments,
      minCpuCores: script.minCpuCores,
      minRamGB: script.minRamGB,
      runOrder: script.runOrder,
      timeoutSeconds: script.timeoutSeconds,
      continueOnFailure: script.continueOnFailure,
      runAsRoot: script.runAsRoot,
      injectSecrets: script.injectSecrets,
      enabled: script.enabled,
    })
    setFormError(null)
    setShowConditions(
      script.environments.length > 0 ||
      script.minCpuCores !== null ||
      script.minRamGB !== null,
    )
    setDialogStep("form")
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)
    setIsSaving(true)
    try {
      if (editingScript) {
        await apiRef.current.updateScript(editingScript.id, formData)
      } else {
        await apiRef.current.createScript(formData)
      }
      setIsDialogOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save script")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (script: StartupScript) => {
    try {
      await apiRef.current.toggleScript(script.id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle script")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await apiRef.current.deleteScript(deleteTarget.id)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete script")
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSecret = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      injectSecrets: prev.injectSecrets.includes(name)
        ? prev.injectSecrets.filter((s) => s !== name)
        : [...prev.injectSecrets, name],
    }))
  }

  const toggleEnvironment = (env: string) => {
    setFormData((prev) => ({
      ...prev,
      environments: prev.environments.includes(env)
        ? prev.environments.filter((e) => e !== env)
        : [...prev.environments, env],
    }))
  }

  const activeCount = scripts.filter((s) => s.enabled).length

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-foreground">
            Startup Scripts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define scripts that run automatically when your sandboxes start. Scripts can access your encrypted secrets.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--btn-primary-bg,hsl(var(--primary)))] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))]"
        >
          <Plus className="h-4 w-4" />
          New Script
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Scripts</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-2xl font-extrabold text-foreground">{scripts.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-2xl font-extrabold text-foreground">{activeCount}</span>
            <span className="text-xs text-muted-foreground">of {scripts.length}</span>
          </div>
        </div>
        <InfoPanel
          className="md:col-span-2"
          label="Execution"
          title="Scripts run before your agent starts."
          description="They execute in order, with full access to injected secrets as environment variables."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Unified Create/Edit Dialog — single dialog, step-based content */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Step: Picker */}
          {dialogStep === "picker" && (
            <div
              key={`picker-${stepKey}`}
              className={cn(
                "animate-in fade-in duration-300",
                transitionDir === "back" ? "slide-in-from-left-4" : "slide-in-from-right-4",
              )}
            >
              <DialogHeader>
                <DialogTitle>New Startup Script</DialogTitle>
                <DialogDescription>Start from a template or create a blank script.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Blank Script</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(SCRIPT_TYPE_META) as [ScriptType, typeof SCRIPT_TYPE_META.bash][]).map(([type, meta]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => openBlankScript(type)}
                        className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary/30 hover:bg-muted/50 transition-colors"
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Templates</p>
                  <div className="space-y-2">
                    {SCRIPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => openFromTemplate(tmpl)}
                        className="w-full text-left rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{tmpl.name}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">{tmpl.description}</p>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            {SCRIPT_TYPE_META[tmpl.scriptType].label}
                          </span>
                        </div>
                        {tmpl.injectSecrets.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tmpl.injectSecrets.map((s) => (
                              <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                <Lock className="h-2.5 w-2.5" />
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Form */}
          {dialogStep === "form" && (
            <div
              key={`form-${stepKey}`}
              className={cn(
                "animate-in fade-in duration-300",
                transitionDir === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4",
              )}
            >
          <DialogHeader>
            <DialogTitle>{editingScript ? "Edit Script" : "Create Startup Script"}</DialogTitle>
            <DialogDescription>
              {editingScript
                ? "Modify your startup script configuration."
                : "Define a shell script that runs when sandboxes start. Scripts execute before the AI agent."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Install Claude Code"
                maxLength={64}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Sets up Claude Code with authentication"
                maxLength={256}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Script Type */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Language</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(Object.entries(SCRIPT_TYPE_META) as [ScriptType, typeof SCRIPT_TYPE_META.bash][]).map(([type, meta]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const currentMeta = SCRIPT_TYPE_META[formData.scriptType]
                      const isDefaultContent = formData.content === currentMeta.template
                      setFormData((p) => ({
                        ...p,
                        scriptType: type,
                        content: isDefaultContent ? meta.template : p.content,
                      }))
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors",
                      formData.scriptType === type
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/20",
                    )}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Script Content */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Script</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                rows={12}
                spellCheck={false}
                className="mt-1.5 w-full rounded-lg border border-border bg-[var(--depth-1,hsl(var(--muted)))] px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {SCRIPT_TYPE_META[formData.scriptType].label} script. Injected secrets are available as environment variables (e.g. <code className="text-primary">$GITHUB_TOKEN</code>).
              </p>
            </div>

            {/* Secrets Injection */}
            {secrets.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Inject Secrets
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">Select secrets to make available as environment variables.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {secrets.map((secret) => {
                    const selected = formData.injectSecrets.includes(secret.name)
                    return (
                      <button
                        key={secret.name}
                        type="button"
                        onClick={() => toggleSecret(secret.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                          selected
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-muted border-border text-muted-foreground hover:border-primary/20",
                        )}
                      >
                        <Lock className="h-3 w-3" />
                        {secret.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Conditions (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowConditions(!showConditions)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConditions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Conditions & Execution
              </button>

              {showConditions && (
                <div className="mt-3 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  {/* Environments */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Environments
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {environments.length > 0
                        ? "Only run for these environments. Leave empty to run for all."
                        : "No templates configured. Script will run for all environments."}
                    </p>
                    {environments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {environments.map((env) => {
                          const selected = formData.environments.includes(env.id)
                          return (
                            <button
                              key={env.id}
                              type="button"
                              onClick={() => toggleEnvironment(env.id)}
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                selected
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-background border-border text-muted-foreground hover:border-primary/20",
                              )}
                            >
                              {env.name || env.id}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Resource thresholds */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5" />
                        Min CPU Cores
                      </label>
                      <input
                        type="number"
                        value={formData.minCpuCores ?? ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            minCpuCores: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder="Any"
                        min={0.5}
                        step={0.5}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <MemoryStick className="h-3.5 w-3.5" />
                        Min RAM (GB)
                      </label>
                      <input
                        type="number"
                        value={formData.minRamGB ?? ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            minRamGB: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder="Any"
                        min={1}
                        step={1}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Execution config */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5" />
                        Run Order
                      </label>
                      <input
                        type="number"
                        value={formData.runOrder}
                        onChange={(e) => setFormData((p) => ({ ...p, runOrder: Number(e.target.value) }))}
                        min={0}
                        max={9999}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Lower runs first</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={formData.timeoutSeconds}
                        onChange={(e) => setFormData((p) => ({ ...p, timeoutSeconds: Number(e.target.value) }))}
                        min={5}
                        max={3600}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-foreground">Continue on failure</span>
                        <p className="text-xs text-muted-foreground">If script fails, continue starting the sandbox</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, continueOnFailure: !p.continueOnFailure }))}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          formData.continueOnFailure ? "bg-primary" : "bg-border",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                            formData.continueOnFailure && "translate-x-5",
                          )}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-foreground">Run as root</span>
                        <p className="text-xs text-muted-foreground">Execute with root privileges instead of the agent user</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, runAsRoot: !p.runAsRoot }))}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          formData.runAsRoot ? "bg-primary" : "bg-border",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                            formData.runAsRoot && "translate-x-5",
                          )}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {!editingScript && (
                <button
                  type="button"
                  onClick={() => goToStep("picker")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim() || !formData.content.trim()}
                className="rounded-lg bg-[var(--btn-primary-bg,hsl(var(--primary)))] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))] disabled:opacity-50"
              >
                {isSaving ? "Saving..." : editingScript ? "Save Changes" : "Create Script"}
              </button>
            </div>
          </DialogFooter>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Startup Script</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scripts List */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="text-xs font-bold uppercase tracking-widest text-foreground">
              All Scripts
            </button>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{scripts.length} script{scripts.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No startup scripts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Create a script to run automatically when your sandboxes start.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--btn-primary-bg,hsl(var(--primary)))] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))]"
            >
              <Plus className="h-4 w-4" />
              Create Script
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {scripts.map((script) => (
              <div
                key={script.id}
                className={cn(
                  "group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/30",
                  !script.enabled && "opacity-60",
                )}
              >
                {/* Status indicator */}
                <button
                  type="button"
                  onClick={() => handleToggle(script)}
                  title={script.enabled ? "Disable" : "Enable"}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    script.enabled
                      ? "bg-[var(--surface-success-bg,hsl(142 76% 90%))] text-[var(--surface-success-text,hsl(142 76% 36%))]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {script.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate">{script.name}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      {SCRIPT_TYPE_META[script.scriptType ?? "bash"].label}
                    </span>
                    {script.runOrder !== 100 && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        #{script.runOrder}
                      </span>
                    )}
                  </div>
                  {script.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{script.description}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {script.environments.map((env) => (
                      <span key={env} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {env}
                      </span>
                    ))}
                    {script.injectSecrets.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" />
                        {s}
                      </span>
                    ))}
                    {script.continueOnFailure && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        soft fail
                      </span>
                    )}
                    {script.runAsRoot && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        root
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeout */}
                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {script.timeoutSeconds}s
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEdit(script)}
                    className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(script)}
                    className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-white">
              <Play className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">How Scripts Run</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Scripts execute in order after the container starts but before the AI agent. They run as bash scripts with full access to mounted tools (Nix profile) and workspace. Failed scripts abort sandbox creation unless "continue on failure" is enabled.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-white">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Security & Secrets</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Selected secrets are injected as environment variables at execution time. Secret values are never stored in the script itself — they are decrypted and injected only when the sandbox starts. Scripts can use conditions to restrict execution to specific environments or resource tiers.
          </p>
        </div>
      </div>
    </div>
  )
}
