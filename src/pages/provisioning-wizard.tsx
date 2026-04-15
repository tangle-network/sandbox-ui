"use client";

import * as React from "react";
import {
  ArrowLeft,
  Layers,
  Cpu,
  Bot,
  Info,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { cn } from "../lib/utils";

export interface EnvironmentOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export interface EnvironmentEntry {
  id: string;
  description?: string;
  version?: string;
}

export interface ResourceLimits {
  cpuMax?: number;
  ramMaxGB?: number;
  storageMaxGB?: number;
}

export interface ModelOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PricingRates {
  cpuPerHr: number;
  ramPerGbHr: number;
  diskPerGbHr: number;
  minChargePerHr?: number;
}

/**
 * Describes one selectable plan tier for the purpose of badging locked
 * presets with the *correct* upgrade target. Without this, every locked
 * preset shows "Pro" — wrong for a user who is already on Pro and whose
 * next step up is Enterprise.
 */
export interface PlanTierInfo {
  /** Stable id (e.g. "free" | "pro" | "enterprise") */
  id: string;
  /** Short badge label shown on locked presets (e.g. "Pro", "Enterprise") */
  label: string;
  cpuMax: number;
  ramMaxGB: number;
  storageMaxGB: number;
}

export interface ProvisioningWizardProps {
  environments?: EnvironmentOption[];
  onLoadEnvironments?: () => Promise<EnvironmentEntry[]>;
  onSubmit?: (config: ProvisioningConfig) => void | Promise<void>;
  onBack?: () => void;
  className?: string;
  variant?: "flat" | "multistep";
  /** Pre-select an environment by ID (e.g. from a template link) */
  defaultEnvironment?: string;
  /** Pre-fill all form fields from a template preset */
  defaultConfig?: Partial<ProvisioningConfig>;
  /** When true and defaultConfig is provided, start on the final step */
  skipToReview?: boolean;
  /** Load user's startup scripts for the advanced options selector */
  onLoadStartupScripts?: () => Promise<StartupScriptEntry[]>;
  /** Plan-based resource limits — caps the slider maximums */
  resourceLimits?: ResourceLimits;
  /** Override the list of model engines shown in step 3 */
  modelOptions?: ModelOption[];
  /** Real pricing rates from the API for accurate cost calculation */
  pricingRates?: PricingRates;
  /**
   * Ordered list of plan tiers (smallest to largest). When provided,
   * locked presets are badged with the label of the smallest tier that
   * would unlock them. Falls back to a generic "Pro" badge when omitted.
   */
  planTiers?: PlanTierInfo[];
}

export interface StartupScriptEntry {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  injectSecrets: string[];
}

export interface ProvisioningConfig {
  environment: string;
  cpuCores: number;
  ramGB: number;
  storageGB: number;
  modelTier: string;
  systemPrompt: string;
  name: string;
  gitUrl: string;
  envVars: { key: string; value: string }[];
  driver: "docker" | "firecracker" | "tangle";
  bare: boolean;
  startupScriptIds?: string[];
}

const VALID_DRIVERS: ReadonlySet<string> = new Set([
  "docker",
  "firecracker",
  "tangle",
]);

const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
  { value: "claude-sonnet", label: "Claude Sonnet 4.6 (Highly Capable)" },
];

/**
 * Fallback modelTier used by the initial state and the "Start from
 * scratch" reset when the caller hasn't supplied `modelOptions`. Kept
 * as a single source of truth so a future rename of the default model
 * doesn't leave any code path out of sync.
 */
const DEFAULT_MODEL_TIER: string =
  DEFAULT_MODEL_OPTIONS[0]?.value ?? "claude-sonnet";

const STACK_DISPLAY: Record<
  string,
  { name: string; abbr: string; color: string; textClass: string }
> = {
  universal: {
    name: "Default",
    abbr: "D",
    color: "violet",
    textClass: "text-[var(--surface-violet-text)]",
  },
  ethereum: {
    name: "Ethereum",
    abbr: "Ξ",
    color: "blue",
    textClass: "text-[var(--surface-info-text)]",
  },
  solana: {
    name: "Solana",
    abbr: "S",
    color: "green",
    textClass: "text-[var(--surface-success-text)]",
  },
  tangle: {
    name: "Tangle",
    abbr: "T",
    color: "purple",
    textClass: "text-[var(--surface-violet-text)]",
  },
  "ai-sdk": {
    name: "AI SDK",
    abbr: "AI",
    color: "teal",
    textClass: "text-[var(--surface-teal-text)]",
  },
  rust: {
    name: "Rust",
    abbr: "Rs",
    color: "orange",
    textClass: "text-[var(--surface-orange-text)]",
  },
};

export function resolveEnvironment(env: EnvironmentEntry): EnvironmentOption {
  // User-created templates have IDs like "template:{uuid}"
  if (env.id.startsWith("template:")) {
    const templateName =
      env.description?.replace(/^Template:\s*/, "") ?? "Custom Template";
    return {
      id: env.id,
      name: templateName,
      description: env.description ?? "User template from snapshot",
      icon: (
        <span className="text-[var(--surface-success-text)] text-2xl font-bold">
          T
        </span>
      ),
      color: "green",
    };
  }

  const display = STACK_DISPLAY[env.id];
  const name =
    display?.name ??
    (env.id.length > 0
      ? env.id.charAt(0).toUpperCase() + env.id.slice(1).replace(/-/g, " ")
      : "Unknown");
  const abbr =
    display?.abbr ?? (env.id.length > 0 ? env.id[0].toUpperCase() : "?");
  const color = display?.color ?? "slate";
  const textClass = display?.textClass ?? "text-muted-foreground";
  return {
    id: env.id,
    name,
    description: env.description ?? `${name} development environment`,
    icon: <span className={`${textClass} text-2xl font-bold`}>{abbr}</span>,
    color,
  };
}

const defaultEnvironments: EnvironmentOption[] = [
  {
    id: "node",
    name: "Node.js",
    description:
      "v20.x LTS with optimized runtime for asynchronous event-driven agents.",
    icon: (
      <span className="text-[var(--code-success)] text-2xl font-bold">N</span>
    ),
    color: "green",
  },
  {
    id: "python",
    name: "Python",
    description:
      "v3.11 pre-installed with PyTorch and common data science libraries.",
    icon: <span className="text-sky-400 text-2xl font-bold">Py</span>,
    color: "blue",
  },
  {
    id: "ubuntu",
    name: "Ubuntu",
    description:
      "Full 22.04 LTS terminal access for custom containerized workloads.",
    icon: <span className="text-orange-400 text-2xl font-bold">U</span>,
    color: "orange",
  },
];

const CPU_MIN = 0.5;
const CPU_MAX = 8;
const RAM_MIN = 2;
const RAM_MAX = 32;
const STORAGE_MIN = 20;
const STORAGE_MAX = 512;

const DEFAULT_PRICING_RATES: PricingRates = {
  cpuPerHr: 0.045,
  ramPerGbHr: 0.005,
  diskPerGbHr: 0.0011,
  minChargePerHr: undefined,
};

type PricingView = "hourly" | "perSecond";

function formatPerSecondValue(hourlyValue: number): string {
  const perSec = hourlyValue / 3600;
  return perSec.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Real (unclamped) resource preset values. The wizard locks any preset
 * that exceeds the current plan's limits rather than rewriting its
 * values, so every user sees the same three rows but the locked ones
 * carry an upsell badge. Hoisted out of the component body so the
 * array identity is stable across renders.
 */
const RAW_PRESETS: ReadonlyArray<{
  name: string;
  cpu: number;
  ram: number;
  storage: number;
}> = [
  { name: "Lightweight", cpu: 2, ram: 4, storage: 50 },
  { name: "Standard", cpu: 4, ram: 16, storage: 128 },
  { name: "Performance", cpu: 8, ram: 32, storage: 256 },
];

function calcCost(
  cpu: number,
  ram: number,
  storage: number,
  rates: PricingRates,
): string {
  const cost = Math.max(
    rates.minChargePerHr ?? 0,
    cpu * rates.cpuPerHr + ram * rates.ramPerGbHr + storage * rates.diskPerGbHr,
  );
  return cost.toFixed(2);
}

export function ProvisioningWizard({
  environments: environmentsProp,
  onLoadEnvironments,
  onSubmit,
  onBack,
  className,
  variant = "flat",
  defaultEnvironment,
  defaultConfig,
  skipToReview,
  onLoadStartupScripts,
  resourceLimits,
  modelOptions,
  pricingRates,
  planTiers,
}: ProvisioningWizardProps) {
  const cpuMax = Math.max(
    CPU_MIN,
    Math.min(resourceLimits?.cpuMax ?? CPU_MAX, CPU_MAX),
  );
  const ramMax = Math.max(
    RAM_MIN,
    Math.min(resourceLimits?.ramMaxGB ?? RAM_MAX, RAM_MAX),
  );
  const storageMax = Math.max(
    STORAGE_MIN,
    Math.min(resourceLimits?.storageMaxGB ?? STORAGE_MAX, STORAGE_MAX),
  );
  const dc = defaultConfig;
  const [envList, setEnvList] = React.useState<EnvironmentOption[]>(
    environmentsProp ?? defaultEnvironments,
  );

  const onLoadEnvironmentsRef = React.useRef(onLoadEnvironments);
  onLoadEnvironmentsRef.current = onLoadEnvironments;

  React.useEffect(() => {
    let cancelled = false;
    if (onLoadEnvironmentsRef.current) {
      onLoadEnvironmentsRef
        .current()
        .then((entries) => {
          if (!cancelled) setEnvList(entries.map(resolveEnvironment));
        })
        .catch((err) => {
          if (!cancelled)
            setLoadError(
              err instanceof Error
                ? err.message
                : "Failed to load environments",
            );
        });
    } else if (environmentsProp) {
      setEnvList(environmentsProp);
    }
    return () => {
      cancelled = true;
    };
  }, [environmentsProp]);

  const environments = envList;

  const effectiveDefault = dc?.environment ?? defaultEnvironment;
  const [selectedEnv, setSelectedEnv] = React.useState(
    effectiveDefault ?? environments[0]?.id ?? "",
  );

  // Sync selection when environments load asynchronously and a default was requested
  React.useEffect(() => {
    if (effectiveDefault && envList.some((e) => e.id === effectiveDefault)) {
      setSelectedEnv(effectiveDefault);
    }
  }, [envList, effectiveDefault]);
  const [cpuCores, setCpuCores] = React.useState(
    Math.min(dc?.cpuCores ?? 4, cpuMax),
  );
  const [ramGB, setRamGB] = React.useState(Math.min(dc?.ramGB ?? 16, ramMax));
  const [storageGB, setStorageGB] = React.useState(
    Math.min(dc?.storageGB ?? 128, storageMax),
  );

  React.useEffect(() => {
    setCpuCores((prev) => Math.min(prev, cpuMax));
    setRamGB((prev) => Math.min(prev, ramMax));
    setStorageGB((prev) => Math.min(prev, storageMax));
  }, [cpuMax, ramMax, storageMax]);

  const [modelTier, setModelTier] = React.useState(
    dc?.modelTier ?? DEFAULT_MODEL_TIER,
  );
  const [systemPrompt, setSystemPrompt] = React.useState(
    dc?.systemPrompt ?? "",
  );

  // If the current modelTier is not in the options list, or is present but disabled,
  // auto-select the first available option so the <select> always reflects a real value.
  React.useEffect(() => {
    const options = modelOptions ?? DEFAULT_MODEL_OPTIONS;
    if (options.length === 0) return;
    const currentOption = options.find((o) => o.value === modelTier);
    if (!currentOption || currentOption.disabled) {
      const firstAvailable = options.find((o) => !o.disabled);
      if (firstAvailable && firstAvailable.value !== modelTier) {
        setModelTier(firstAvailable.value);
      }
    }
  }, [modelOptions, modelTier]);
  const [name, setName] = React.useState(dc?.name ?? "");
  const [gitUrl, setGitUrl] = React.useState(dc?.gitUrl ?? "");
  const [envVars, setEnvVars] = React.useState<
    { key: string; value: string }[]
  >(dc?.envVars ?? [{ key: "", value: "" }]);
  const [driver, setDriver] = React.useState<
    "docker" | "firecracker" | "tangle"
  >(dc?.driver ?? "docker");
  const [bare, setBare] = React.useState(dc?.bare ?? false);
  const [startupScriptIds, setStartupScriptIds] = React.useState<string[]>(
    dc?.startupScriptIds ?? [],
  );
  const [availableScripts, setAvailableScripts] = React.useState<
    StartupScriptEntry[]
  >([]);
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  const [pricingView, setPricingView] = React.useState<PricingView>("hourly");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const onLoadStartupScriptsRef = React.useRef(onLoadStartupScripts);
  onLoadStartupScriptsRef.current = onLoadStartupScripts;

  React.useEffect(() => {
    let cancelled = false;
    if (onLoadStartupScriptsRef.current) {
      onLoadStartupScriptsRef
        .current()
        .then((scripts) => {
          if (!cancelled) setAvailableScripts(scripts);
        })
        .catch((err) => {
          if (!cancelled)
            setLoadError(
              err instanceof Error
                ? err.message
                : "Failed to load startup scripts",
            );
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const isMultistep = variant === "multistep";
  const [currentStep, setCurrentStep] = React.useState(
    skipToReview && dc && isMultistep ? 3 : 1,
  );

  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deployError, setDeployError] = React.useState<string | null>(null);

  const handleDeploy = async () => {
    if (!onSubmit) return;
    setIsDeploying(true);
    setDeployError(null);
    try {
      const validScriptIds = new Set(
        availableScripts.filter((s) => s.enabled).map((s) => s.id),
      );
      await onSubmit({
        environment: selectedEnv,
        cpuCores,
        ramGB,
        storageGB,
        modelTier,
        systemPrompt,
        name,
        gitUrl,
        envVars: envVars.filter((e) => e.key.trim() !== ""),
        driver,
        bare,
        startupScriptIds: startupScriptIds.filter((id) =>
          validScriptIds.has(id),
        ),
      });
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const applyPreset = (
    name: string,
    cpu: number,
    ram: number,
    storage: number,
  ) => {
    setCpuCores(Math.min(cpu, cpuMax));
    setRamGB(Math.min(ram, ramMax));
    setStorageGB(Math.min(storage, storageMax));
    setActivePreset(name);
  };

  // Determine which presets fit within user's limits and mark locked ones.
  // For each locked preset, compute the smallest `planTiers` entry that
  // would unlock it — so a Pro user sees "Enterprise" on presets that
  // exceed their Pro limits, instead of a misleading "Pro" badge.
  const presets = RAW_PRESETS.map((p) => {
    const locked = p.cpu > cpuMax || p.ram > ramMax || p.storage > storageMax;
    let unlockLabel: string | undefined;
    if (locked && planTiers && planTiers.length > 0) {
      const unlocking = planTiers.find(
        (t) =>
          p.cpu <= t.cpuMax &&
          p.ram <= t.ramMaxGB &&
          p.storage <= t.storageMaxGB,
      );
      unlockLabel = unlocking?.label;
    }
    return {
      ...p,
      fits: !locked,
      locked,
      unlockLabel: unlockLabel ?? "Pro",
    };
  });

  // Initialise preset selection. Re-runs when the effective limits
  // actually change (tracked via a ref to avoid firing on every render)
  // because wrappers usually load `resourceLimits` async via SWR — the
  // first render sees the unclamped CPU_MAX/RAM_MAX/STORAGE_MAX
  // defaults, and without this we'd freeze `activePreset = "Performance"`
  // for a free-tier user once the real limits arrived.
  //
  //  - dc flow (edit): the edit-flow init only runs once, matching the
  //    saved cpu/ram/storage against the real (unclamped) preset values
  //    so the saved state isn't overwritten.
  //  - new-sandbox flow: pick the largest preset that fits the current
  //    limits; if none fit (free tier), clear `activePreset` so no
  //    button shows as selected.
  const didInitPresetFromDcRef = React.useRef(false);
  const lastLimitsRef = React.useRef<{
    cpu: number;
    ram: number;
    storage: number;
  } | null>(null);
  React.useEffect(() => {
    const limitsUnchanged =
      lastLimitsRef.current !== null &&
      lastLimitsRef.current.cpu === cpuMax &&
      lastLimitsRef.current.ram === ramMax &&
      lastLimitsRef.current.storage === storageMax;
    if (limitsUnchanged) return;
    lastLimitsRef.current = { cpu: cpuMax, ram: ramMax, storage: storageMax };

    if (dc && !didInitPresetFromDcRef.current) {
      didInitPresetFromDcRef.current = true;
      const matching = RAW_PRESETS.find(
        (p) =>
          p.cpu === dc.cpuCores &&
          p.ram === dc.ramGB &&
          p.storage === dc.storageGB,
      );
      if (matching) setActivePreset(matching.name);
      return;
    }

    const largestFitting = [...RAW_PRESETS]
      .reverse()
      .find(
        (p) => p.cpu <= cpuMax && p.ram <= ramMax && p.storage <= storageMax,
      );
    if (largestFitting) {
      applyPreset(
        largestFitting.name,
        largestFitting.cpu,
        largestFitting.ram,
        largestFitting.storage,
      );
    } else {
      setActivePreset(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuMax, ramMax, storageMax, dc]);

  const effectivePricingRates = pricingRates ?? DEFAULT_PRICING_RATES;
  const hourCost = calcCost(cpuCores, ramGB, storageGB, effectivePricingRates);

  return (
    <div className={cn("max-w-6xl mx-auto flex flex-col", className)}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted/50 transition-colors text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">
            Sandbox Provisioning
          </h1>
          <p className="text-muted-foreground text-sm">
            Select your stack, allocate resources, and configure your agent.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: Configuration Form */}
        <div className="col-span-12 xl:col-span-8 flex flex-col min-h-0">
          {isMultistep && (
            <div className="flex items-center gap-2 mb-4 bg-card border border-border p-3 rounded-2xl mx-auto max-w-2xl justify-between shrink-0">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all duration-200",
                      currentStep === s
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-card shadow-sm"
                        : currentStep > s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border text-muted-foreground",
                    )}
                  >
                    {currentStep > s ? <Check className="h-3.5 w-3.5" /> : s}
                  </div>
                  <span
                    className={cn(
                      "ml-2 sm:ml-3 font-bold text-sm tracking-tight hidden sm:inline transition-colors duration-200",
                      currentStep === s
                        ? "text-foreground"
                        : currentStep > s
                          ? "text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {s === 1 && "Environment"}
                    {s === 2 && "Resources"}
                    {s === 3 && "AI Agent"}
                  </span>
                  {s < 3 && (
                    <div
                      className={cn(
                        "w-4 sm:w-8 h-0.5 mx-2 sm:mx-4 rounded-full transition-colors duration-300",
                        currentStep > s ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Template pre-fill banner */}
          {dc && isMultistep && (
            <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Pre-configured from template.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  setSelectedEnv(environments[0]?.id ?? "");
                  setCpuCores(Math.min(4, cpuMax));
                  setRamGB(Math.min(16, ramMax));
                  setStorageGB(Math.min(128, storageMax));
                  // Use the first *available* option from the caller's
                  // `modelOptions` so the <select> never renders an unknown
                  // value between this reset and the auto-correct effect.
                  // Falls back to the hardcoded default when the caller
                  // didn't supply options at all.
                  {
                    const resetOptions = modelOptions ?? DEFAULT_MODEL_OPTIONS;
                    const firstAvailable = resetOptions.find(
                      (o) => !o.disabled,
                    );
                    setModelTier(firstAvailable?.value ?? DEFAULT_MODEL_TIER);
                  }
                  setSystemPrompt("");
                  setName("");
                  setGitUrl("");
                  setEnvVars([{ key: "", value: "" }]);
                  setDriver("docker");
                  setBare(false);
                  setStartupScriptIds([]);
                  setActivePreset(null);
                }}
                className="text-xs font-bold text-primary hover:text-primary/70 transition-colors"
              >
                Start from scratch
              </button>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 shrink-0">
              <Info className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {loadError}
              </p>
            </div>
          )}

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
            {(!isMultistep || currentStep === 1) && (
              <React.Fragment>
                {/* Section 1: Environment */}
                <section className="bg-card border border-border rounded-[24px] p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Layers className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      Environment Selection
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {environments.map((env) => (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => setSelectedEnv(env.id)}
                        className={cn(
                          "group relative p-4 rounded-[16px] text-left overflow-hidden border transition-all duration-200",
                          selectedEnv === env.id
                            ? "bg-primary/5 border-primary ring-2 ring-primary/20 shadow-md"
                            : "bg-card border-border hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98]",
                        )}
                      >
                        {selectedEnv === env.id && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent pointer-events-none" />
                        )}
                        <div className="flex justify-between items-start mb-3 relative z-10">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/50 border border-border shadow-inner">
                            {env.icon}
                          </div>
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                              selectedEnv === env.id
                                ? "border-primary bg-primary"
                                : "border-border group-hover:border-primary/40",
                            )}
                          >
                            {selectedEnv === env.id && (
                              <Check className="h-3 w-3 text-primary-foreground animate-in zoom-in duration-200" />
                            )}
                          </div>
                        </div>
                        <h3 className="font-bold text-sm mb-0.5 text-foreground relative z-10">
                          {env.name}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed relative z-10">
                          {env.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              </React.Fragment>
            )}

            {(!isMultistep || currentStep === 2) && (
              <React.Fragment>
                {/* Section 2: Resources */}
                <section className="bg-card border border-border rounded-[24px] p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      Resource Allocation
                    </h2>
                  </div>

                  <div className="mb-6">
                    <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Compute Presets
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {presets.map((p) => {
                        // A locked preset must never paint as active, even if an
                        // earlier render or stale state set activePreset to its name
                        // (e.g. before async resourceLimits arrived).
                        const active = activePreset === p.name && !p.locked;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() =>
                              !p.locked &&
                              applyPreset(p.name, p.cpu, p.ram, p.storage)
                            }
                            disabled={p.locked}
                            className={cn(
                              "p-3 rounded-[14px] transition-all duration-200 text-center group border relative",
                              active
                                ? "bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm"
                                : p.locked
                                  ? "bg-muted/30 border-border opacity-60 cursor-not-allowed"
                                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm active:scale-[0.97]",
                            )}
                          >
                            {p.locked && (
                              <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                {p.unlockLabel}
                              </div>
                            )}
                            <div
                              className={cn(
                                "font-bold text-sm transition-colors duration-200",
                                active
                                  ? "text-primary"
                                  : p.locked
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                              )}
                            >
                              {p.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {p.cpu} vCPU{p.cpu === 1 ? "" : "s"} / {p.ram}GB /{" "}
                              {p.storage}GB
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {[
                      {
                        label: "Compute Cores (CPU)",
                        value: cpuCores,
                        setter: setCpuCores,
                        min: CPU_MIN,
                        max: cpuMax,
                        step: 0.5,
                        unit: "vCPU",
                      },
                      {
                        label: "Memory (RAM)",
                        value: ramGB,
                        setter: setRamGB,
                        min: RAM_MIN,
                        max: ramMax,
                        step: 1,
                        unit: "GB",
                      },
                      {
                        label: "Ephemeral Storage",
                        value: storageGB,
                        setter: setStorageGB,
                        min: STORAGE_MIN,
                        max: storageMax,
                        step: 8,
                        unit: "GB",
                      },
                    ].map(
                      ({ label, value, setter, min, max, step: s, unit }) => {
                        const displayUnit =
                          unit === "vCPU"
                            ? `${value} vCPU${value === 1 ? "" : "s"}`
                            : `${value}${unit}`;
                        return (
                          <div key={label}>
                            <div className="flex justify-between items-end border-b border-border pb-1.5 mb-2">
                              <label className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                {label}
                              </label>
                              <span className="text-xl font-bold text-foreground tracking-tight">
                                {displayUnit}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={s}
                              value={value}
                              onChange={(e) => {
                                setter(+e.target.value);
                                setActivePreset(null);
                              }}
                              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-runnable-track]:bg-border [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:bg-border [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-foreground [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                            />
                            <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60 mt-1">
                              <span>
                                {min}
                                {unit === "vCPU"
                                  ? min === 1
                                    ? " vCPU"
                                    : " vCPUs"
                                  : unit}
                              </span>
                              <span>
                                {max}
                                {unit === "vCPU"
                                  ? max === 1
                                    ? " vCPU"
                                    : " vCPUs"
                                  : unit}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>
              </React.Fragment>
            )}

            {(!isMultistep || currentStep === 3) && (
              <React.Fragment>
                {/* Section 3: AI Agent */}
                <section className="bg-card border border-border rounded-[24px] p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      AI Agent Capability
                    </h2>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        Model Engine
                      </label>
                      <select
                        value={modelTier}
                        onChange={(e) => setModelTier(e.target.value)}
                        disabled={
                          modelOptions &&
                          modelOptions.filter((o) => !o.disabled).length === 0
                        }
                        className="w-full bg-card border border-border rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {(modelOptions ?? DEFAULT_MODEL_OPTIONS).map(
                          (option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={option.disabled}
                              className="bg-gray-900"
                            >
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>
                      {modelOptions &&
                        modelOptions.length > 0 &&
                        modelOptions.every((o) => o.disabled) && (
                          <p className="text-xs text-muted-foreground mt-2">
                            All model options are currently disabled. Please
                            upgrade your plan or contact support.
                          </p>
                        )}
                    </div>
                    <div>
                      <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        Core Directives (System Prompt)
                      </label>
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        maxLength={10000}
                        className="w-full bg-card border border-border rounded-xl p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-32 resize-none placeholder:text-muted-foreground"
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
                        {showAdvanced
                          ? "Hide Advanced Options"
                          : "Show Advanced Options"}
                      </button>

                      {showAdvanced && (
                        <div className="mt-6 space-y-5 animate-in slide-in-from-top-4 fade-in duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Workspace Name
                              </label>
                              <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={128}
                                className="w-full bg-card border border-border rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                                placeholder="my-cool-sandbox"
                              />
                            </div>
                            <div>
                              <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Virtualization Driver
                              </label>
                              <select
                                value={driver}
                                onChange={(e) => {
                                  if (VALID_DRIVERS.has(e.target.value))
                                    setDriver(
                                      e.target
                                        .value as ProvisioningConfig["driver"],
                                    );
                                }}
                                className="w-full bg-card border border-border rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                              >
                                <option value="docker" className="bg-gray-900">
                                  Docker container (Default)
                                </option>
                                <option
                                  value="firecracker"
                                  className="bg-gray-900"
                                >
                                  Firecracker microVM (Secure)
                                </option>
                                <option value="tangle" className="bg-gray-900">
                                  Tangle Distributed Node
                                </option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                              Git Repository URL
                            </label>
                            <input
                              type="text"
                              value={gitUrl}
                              onChange={(e) => setGitUrl(e.target.value)}
                              className="w-full bg-card border border-border rounded-xl h-12 px-4 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                              placeholder="https://github.com/my-org/my-repo.git"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Environment Variables
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setEnvVars([
                                    ...envVars,
                                    { key: "", value: "" },
                                  ])
                                }
                                className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors font-bold"
                              >
                                <Plus className="h-3 w-3" /> Add Var
                              </button>
                            </div>
                            <div className="space-y-2">
                              {envVars.map((env, i) => (
                                <div key={i} className="flex gap-2">
                                  <input
                                    type="text"
                                    value={env.key}
                                    onChange={(e) =>
                                      setEnvVars(
                                        envVars.map((v, idx) =>
                                          idx === i
                                            ? { ...v, key: e.target.value }
                                            : v,
                                        ),
                                      )
                                    }
                                    className="flex-1 bg-card border border-border rounded-xl h-10 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                                    placeholder="API_KEY"
                                  />
                                  <input
                                    type="password"
                                    value={env.value}
                                    onChange={(e) =>
                                      setEnvVars(
                                        envVars.map((v, idx) =>
                                          idx === i
                                            ? { ...v, value: e.target.value }
                                            : v,
                                        ),
                                      )
                                    }
                                    className="flex-[2] bg-card border border-border rounded-xl h-10 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                                    placeholder="sk-xxxxxxxxxxx"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEnvVars(
                                        envVars.filter((_, idx) => idx !== i),
                                      )
                                    }
                                    className="h-10 w-10 flex items-center justify-center shrink-0 rounded-xl bg-card border border-border text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                              {envVars.length === 0 && (
                                <div className="text-center p-3 bg-card border border-border rounded-xl text-muted-foreground/60 text-sm italic">
                                  No environment variables set
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Startup Scripts */}
                          {availableScripts.length > 0 && (
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Startup Scripts
                              </div>
                              <div className="space-y-2">
                                {availableScripts
                                  .filter((s) => s.enabled)
                                  .map((script) => {
                                    const selected = startupScriptIds.includes(
                                      script.id,
                                    );
                                    return (
                                      <label
                                        key={script.id}
                                        className="flex items-start gap-3 cursor-pointer group rounded-lg border border-border p-3 transition-colors hover:border-primary/30"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={() =>
                                            setStartupScriptIds((prev) =>
                                              selected
                                                ? prev.filter(
                                                    (id) => id !== script.id,
                                                  )
                                                : [...prev, script.id],
                                            )
                                          }
                                          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                            {script.name}
                                          </div>
                                          {script.description && (
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                              {script.description}
                                            </div>
                                          )}
                                          {script.injectSecrets.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {script.injectSecrets.map((s) => (
                                                <span
                                                  key={s}
                                                  className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                                                >
                                                  <svg
                                                    className="h-2.5 w-2.5"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                  >
                                                    <rect
                                                      x="3"
                                                      y="11"
                                                      width="18"
                                                      height="11"
                                                      rx="2"
                                                      ry="2"
                                                    />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                  </svg>
                                                  {s}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-border">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className="relative flex items-center justify-center shrink-0">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={bare}
                                  onChange={(e) => setBare(e.target.checked)}
                                />
                                <div className="w-10 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary hover:bg-muted/80 transition-colors"></div>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-foreground mb-0.5 group-hover:text-primary transition-colors">
                                  Bare Mode
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Start as a raw container without an embedded
                                  AI Agent backend.
                                </div>
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

        {/* Right: Cost estimator */}
        <div className="col-span-12 xl:col-span-4 sticky top-4 space-y-4">
          {/* Cost card */}
          <div className="p-6 rounded-[24px] bg-card border border-primary/15 relative overflow-hidden">
            <div className="hidden" />

            <div className="flex justify-between items-center mb-4 relative z-10">
              <span className="font-label text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Run Cost
              </span>
              <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPricingView("hourly")}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold transition-all",
                    pricingView === "hourly"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  /hr
                </button>
                <button
                  type="button"
                  onClick={() => setPricingView("perSecond")}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold transition-all",
                    pricingView === "perSecond"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  /sec
                </button>
              </div>
            </div>
            {(() => {
              const hourlyNum = parseFloat(hourCost);
              const displayValue =
                pricingView === "hourly"
                  ? hourCost
                  : formatPerSecondValue(hourlyNum);
              const suffix = pricingView === "hourly" ? "/ hour" : "/ sec";
              const rateSuffix = pricingView === "hourly" ? "/h" : "/s";
              const computeCost = cpuCores * effectivePricingRates.cpuPerHr;
              const memoryCost = ramGB * effectivePricingRates.ramPerGbHr;
              const storageCost = storageGB * effectivePricingRates.diskPerGbHr;
              const lineSum = computeCost + memoryCost + storageCost;
              const floor = effectivePricingRates.minChargePerHr ?? 0;
              const floorApplies = floor > lineSum;
              const fmt = (v: number) =>
                pricingView === "hourly"
                  ? v.toFixed(2)
                  : formatPerSecondValue(v);
              return (
                <React.Fragment>
                  <div className="flex items-baseline gap-2 mb-5 relative z-10">
                    <span
                      key={displayValue}
                      className={cn(
                        "font-black text-foreground tracking-tighter animate-in fade-in duration-200",
                        pricingView === "hourly" ? "text-4xl" : "text-2xl",
                      )}
                    >
                      ${displayValue}
                    </span>
                    <span className="text-muted-foreground text-sm font-bold">
                      {suffix}
                    </span>
                  </div>
                  <div className="space-y-2 relative z-10 bg-card border border-border rounded-xl p-3">
                    <div className="flex justify-between text-xs font-mono tracking-widest text-muted-foreground">
                      <span>COMPUTE</span>
                      <span className="text-foreground">
                        ${fmt(computeCost)}
                        {rateSuffix}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-mono tracking-widest text-muted-foreground">
                      <span>MEMORY</span>
                      <span className="text-foreground/80">
                        ${fmt(memoryCost)}
                        {rateSuffix}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-mono tracking-widest text-muted-foreground">
                      <span>STORAGE</span>
                      <span className="text-foreground/80">
                        ${fmt(storageCost)}
                        {rateSuffix}
                      </span>
                    </div>
                    {floorApplies && (
                      <div className="flex justify-between text-xs font-mono tracking-widest text-primary border-t border-border pt-2">
                        <span>MIN CHARGE</span>
                        <span>
                          ${fmt(floor - lineSum)}
                          {rateSuffix}
                        </span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })()}
          </div>

          {/* Deploy error */}
          {deployError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {deployError}
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="space-y-3">
            {isMultistep ? (
              <>
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s + 1)}
                    className="w-full relative overflow-hidden h-12 bg-primary text-primary-foreground font-extrabold text-sm rounded-2xl hover:brightness-110 transition-all active:scale-[0.98] shadow-md"
                  >
                    Continue to{" "}
                    {currentStep === 1 ? "Resources" : "Agent Config"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={isDeploying || !selectedEnv}
                    className="w-full h-12 bg-primary text-primary-foreground font-extrabold text-sm rounded-2xl tracking-wide shadow-md disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    {isDeploying ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deploying...
                      </span>
                    ) : (
                      "Deploy Workspace"
                    )}
                  </button>
                )}
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    className="w-full h-10 bg-secondary text-secondary-foreground border border-border font-bold text-sm rounded-2xl hover:brightness-95 active:scale-[0.98] transition-all"
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
                className="w-full h-12 bg-primary text-primary-foreground font-extrabold text-sm rounded-2xl tracking-wide shadow-md disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {isDeploying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Spinning up environment...
                  </span>
                ) : (
                  "Deploy Workspace"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
