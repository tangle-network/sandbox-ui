"use client";

import * as React from "react";
import {
  ArrowLeft,
  Layers,
  Cpu,
  Info,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "../primitives";
import { AddSshKeyDialog } from "./add-ssh-key-dialog";

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

export interface SshKeyOption {
  id: string;
  name: string;
  fingerprint: string;
  keyType: string;
}

export interface SshAccessConfig {
  keys?: SshKeyOption[];
  selectedKeyIds: string[];
  inlinePublicKeys: string;
  onSelectedKeyIdsChange: (keyIds: string[]) => void;
  onInlinePublicKeysChange: (publicKeys: string) => void;
  /**
   * When provided, the SSH step renders an "Add SSH key" action that
   * opens a dialog for saving a new public key. The host owns the
   * persistence (POST) — this package only exposes the UI and reports
   * the draft. Omit to hide the add-key action entirely.
   */
  onCreateKey?: (input: { name: string; publicKey: string }) => Promise<SshKeyOption | void>;
  /**
   * Optional refresh of the host's key list, called after a successful
   * create so the parent re-syncs its `keys` prop before the new key is
   * selected.
   */
  onRefreshKeys?: () => Promise<SshKeyOption[] | void>;
}

export interface ProvisioningWizardProps {
  environments?: EnvironmentOption[];
  onLoadEnvironments?: () => Promise<EnvironmentEntry[]>;
  onSubmit?: (config: ProvisioningConfig) => void | Promise<void>;
  onBack?: () => void;
  className?: string;
  /**
   * @deprecated The wizard now always renders as a single scrolling page.
   * Kept for backwards compatibility — no longer changes the layout.
   */
  variant?: "flat" | "multistep";
  /** Pre-select an environment by ID (e.g. from a template link) */
  defaultEnvironment?: string;
  /** Pre-fill all form fields from a template preset */
  defaultConfig?: Partial<ProvisioningConfig>;
  /**
   * @deprecated No-op. The wizard no longer uses steps. Kept for
   * backwards compatibility.
   */
  skipToReview?: boolean;
  /** Load user's startup scripts for the advanced options selector */
  onLoadStartupScripts?: () => Promise<StartupScriptEntry[]>;
  /** Plan-based resource limits — caps the slider maximums */
  resourceLimits?: ResourceLimits;
  sshAccess?: SshAccessConfig;
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

// Shared design-system idioms (match src/dashboard/* surfaces).
const SECTION_CARD_CLASS = "rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-5 shadow-sm";
const FIELD_LABEL_CLASS =
  "block text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]";

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

const CPU_STEP = 0.5;
const RAM_STEP = 1;
const STORAGE_STEP = 8;

/**
 * HTML range inputs snap the thumb to the largest step-aligned value
 * ≤ max. When `(max - min)` is not a multiple of `step` the thumb can
 * never reach the right edge of the track, producing a visibly
 * "short" slider whose label claims a bound the user cannot actually
 * select (e.g. STORAGE_MIN=20, plan max=50, step=8 → thumb caps at 44
 * while the right-hand label still reads "50GB").
 *
 * Adjusting the step down to the largest value ≤ desired that divides
 * `(max - min)` exactly keeps the thumb's travel coincident with the
 * labelled range without secretly capping the user's plan allowance.
 *
 * Precision guarantees: integer `desiredStep` → integer result; 0.5
 * `desiredStep` with a max expressible to one decimal → one-decimal
 * result. Callers that pass an integer step with a non-integer range
 * (e.g. `max=50.5`) get `desiredStep` back unchanged — the thumb will
 * still cap short of `max` in that case, by design (see inline note).
 */
export function alignSliderStep(
  min: number,
  max: number,
  desiredStep: number,
): number {
  const range = max - min;
  if (range <= 0 || desiredStep <= 0) return desiredStep;
  // RAM/storage pass an integer desired step; a fractional divisor
  // (e.g. 7.5GB) would be mathematically correct but a poor UX. Keep
  // the step on the same granularity the caller asked for.
  if (Number.isInteger(desiredStep)) {
    if (!Number.isInteger(range)) return desiredStep;
    for (let c = Math.floor(desiredStep); c >= 1; c--) {
      if (range % c === 0) return c;
    }
    // Safety net — unreachable in practice because `c = 1` divides every
    // integer, but required for the function's return-type contract.
    return desiredStep;
  }
  // Fractional step (CPU uses 0.5). Scale by 10 to dodge floating-point
  // modulo quirks — one decimal is enough for every real plan limit the
  // server produces.
  const scale = 10;
  const scaledRange = Math.round(range * scale);
  const scaledStep = Math.round(desiredStep * scale);
  for (let c = scaledStep; c >= 1; c--) {
    if (scaledRange % c === 0) return c / scale;
  }
  // Safety net — see integer-branch note above; scaledRange is an integer
  // by construction, so `c = 1` always matches.
  return desiredStep;
}

/**
 * Snap a value onto the step grid anchored at `min` and bounded by `max`.
 *
 * Range inputs clamp to the grid visually on interaction, but a value
 * seeded from `defaultConfig` (or a preset evaluated under different
 * limits) can sit between stops — e.g. `storageGB=28` on a {20, 26, 32}
 * grid. The browser paints the thumb at the nearest stop while React
 * state still holds the off-grid number, so the reading and the visual
 * disagree until the user drags. Running seed values through this
 * helper keeps state and paint in lock-step.
 */
export function snapSliderValue(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.max(min, Math.min(value, max));
  if (step <= 0) return clamped;
  const steps = Math.round((clamped - min) / step);
  const snapped = min + steps * step;
  return Math.max(min, Math.min(snapped, max));
}

const DEFAULT_PRICING_RATES: PricingRates = {
  cpuPerHr: 0.045,
  ramPerGbHr: 0.005,
  diskPerGbHr: 0.0011,
  minChargePerHr: undefined,
};

type PricingView = "hourly" | "perSecond";

// Per-second display uses a fixed 8-decimal width so that the header and
// every breakdown row line up visually and arithmetically — stripping
// trailing zeros made each row land on a different precision and broke
// header/sum equality.
export function formatPerSecondValue(hourlyValue: number): string {
  return (hourlyValue / 3600).toFixed(8);
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

interface HourlyCostBreakdown {
  compute: number;
  memory: number;
  storage: number;
  lineSum: number;
  floor: number;
  floorApplies: boolean;
  total: number;
}

// Single source of truth for the hourly cost model. Both the run-cost header
// and the per-resource breakdown read from the same struct so that adding a
// new fee component cannot silently desync the two displays.
function computeHourlyCost(
  cpu: number,
  ram: number,
  storage: number,
  rates: PricingRates,
): HourlyCostBreakdown {
  const compute = cpu * rates.cpuPerHr;
  const memory = ram * rates.ramPerGbHr;
  const storageCost = storage * rates.diskPerGbHr;
  const lineSum = compute + memory + storageCost;
  const floor = rates.minChargePerHr ?? 0;
  return {
    compute,
    memory,
    storage: storageCost,
    lineSum,
    floor,
    floorApplies: floor > lineSum,
    total: Math.max(floor, lineSum),
  };
}

function SshAccessStep({ config }: { config: SshAccessConfig }) {
  const keys = config.keys ?? [];
  const canAddKey = typeof config.onCreateKey === "function";
  const [isAddKeyOpen, setIsAddKeyOpen] = React.useState(false);
  const inlineKeyCount = config.inlinePublicKeys
    .split(/\r?\n/)
    .map((key) => key.trim())
    .filter(Boolean).length;
  const totalKeyCount = config.selectedKeyIds.length + inlineKeyCount;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground text-sm">SSH Access</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Select stored keys or paste public keys for authorized_keys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAddKey && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddKeyOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add SSH key
            </Button>
          )}
          <Badge variant="outline">
            {totalKeyCount} key{totalKeyCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {keys.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {keys.map((key) => {
            const selected = config.selectedKeyIds.includes(key.id);
            return (
              <button
                key={key.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  config.onSelectedKeyIdsChange(
                    selected
                      ? config.selectedKeyIds.filter((id) => id !== key.id)
                      : [...config.selectedKeyIds, key.id],
                  );
                }}
                className={cn(
                  "group p-3 text-left rounded-lg border transition-colors duration-200",
                  selected
                    ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                    : "bg-surface-container border-[var(--md3-outline-variant)] hover:border-primary/30 active:scale-[0.99]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-medium text-sm text-foreground">
                      {key.name}
                    </span>
                    <span className="block truncate font-mono text-muted-foreground text-xs">
                      {key.keyType} · {key.fingerprint}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors duration-200",
                      selected
                        ? "border-primary bg-primary"
                        : "border-[var(--md3-outline-variant)] group-hover:border-primary/40",
                    )}
                  >
                    {selected && (
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Textarea
        className="min-h-24 font-mono text-xs"
        placeholder="Paste one public key per line"
        value={config.inlinePublicKeys}
        onChange={(event) => config.onInlinePublicKeysChange(event.target.value)}
      />

      {canAddKey && (
        <AddSshKeyDialog
          open={isAddKeyOpen}
          onOpenChange={setIsAddKeyOpen}
          onCreateKey={config.onCreateKey!}
          onRefreshKeys={config.onRefreshKeys}
          onCreatedKeyId={(id) =>
            config.onSelectedKeyIdsChange(
              config.selectedKeyIds.includes(id)
                ? config.selectedKeyIds
                : [...config.selectedKeyIds, id],
            )
          }
        />
      )}
    </div>
  );
}

/**
 * Internal env-var row. `uid` is a stable per-row identity used as the React
 * key so each row's local reveal state stays bound to its own value across
 * insertions and deletions. It is stripped before submit — `ProvisioningConfig`
 * only carries `{ key, value }`.
 */
interface EnvVarRow {
  uid: string;
  key: string;
  value: string;
}

/**
 * Environment-variable value field with a reveal toggle. Values are masked by
 * default (they commonly hold secrets); the eye button flips to plaintext so
 * the user can verify what they typed without re-entering it.
 */
function EnvVarValueInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="relative flex-[2]">
      <Input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="h-9 px-3 pr-10 font-mono text-sm"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setRevealed((s) => !s)}
        aria-label={revealed ? "Hide value" : "Show value"}
        aria-pressed={revealed}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ProvisioningWizard({
  environments: environmentsProp,
  onLoadEnvironments,
  onSubmit,
  onBack,
  className,
  defaultEnvironment,
  defaultConfig,
  onLoadStartupScripts,
  resourceLimits,
  sshAccess,
  pricingRates,
  planTiers,
}: ProvisioningWizardProps) {
  // CPU_MAX / RAM_MAX / STORAGE_MAX are fallback ceilings, applied only when
  // the caller supplies no plan limits. When `resourceLimits` is present it is
  // authoritative and must not be capped to the fallback — otherwise a
  // higher-tier plan (e.g. Enterprise's 12 vCPU) could never allocate past
  // the default 8.
  const cpuMax = Math.max(CPU_MIN, resourceLimits?.cpuMax ?? CPU_MAX);
  const ramMax = Math.max(RAM_MIN, resourceLimits?.ramMaxGB ?? RAM_MAX);
  const storageMax = Math.max(
    STORAGE_MIN,
    resourceLimits?.storageMaxGB ?? STORAGE_MAX,
  );
  const cpuStep = alignSliderStep(CPU_MIN, cpuMax, CPU_STEP);
  const ramStep = alignSliderStep(RAM_MIN, ramMax, RAM_STEP);
  const storageStep = alignSliderStep(STORAGE_MIN, storageMax, STORAGE_STEP);
  const dc = defaultConfig;
  // When an async loader is provided we must NOT seed with the built-in
  // `defaultEnvironments` — doing so paints Node/Python/Ubuntu with bogus
  // descriptions for one frame before the real list arrives. Start empty
  // and render a skeleton until the loader resolves.
  const [envList, setEnvList] = React.useState<EnvironmentOption[]>(() => {
    if (environmentsProp) return environmentsProp;
    if (onLoadEnvironments) return [];
    return defaultEnvironments;
  });
  const [isLoadingEnvironments, setIsLoadingEnvironments] = React.useState(
    () => !environmentsProp && !!onLoadEnvironments,
  );

  const onLoadEnvironmentsRef = React.useRef(onLoadEnvironments);
  onLoadEnvironmentsRef.current = onLoadEnvironments;

  React.useEffect(() => {
    let cancelled = false;
    if (onLoadEnvironmentsRef.current) {
      setIsLoadingEnvironments(true);
      onLoadEnvironmentsRef
        .current()
        .then((entries) => {
          if (!cancelled) {
            setEnvList(entries.map(resolveEnvironment));
            setIsLoadingEnvironments(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(
              err instanceof Error
                ? err.message
                : "Failed to load environments",
            );
            setIsLoadingEnvironments(false);
          }
        });
    } else if (environmentsProp) {
      setEnvList(environmentsProp);
    }
    return () => {
      cancelled = true;
    };
  }, [environmentsProp]);

  const environments = envList;

  // Hide environment selection only when there's exactly one option: a single
  // choice (e.g. just the default image and no templates) is a no-op, so the
  // picker is omitted and that lone option is used implicitly. Zero options (an
  // empty or failed load) still render the section so the user sees an
  // explanation rather than a silently-disabled deploy button; while loading,
  // the skeleton communicates progress.
  const showEnvironmentSection =
    isLoadingEnvironments || environments.length !== 1;

  const effectiveDefault = dc?.environment ?? defaultEnvironment;
  const [selectedEnv, setSelectedEnv] = React.useState(
    effectiveDefault ?? environments[0]?.id ?? "",
  );

  // Sync selection after async load. With an empty initial envList the
  // state-initializer above sets selectedEnv to "" — once the real list
  // arrives we must land on the requested default (if present and valid),
  // otherwise the first real option, otherwise preserve whatever the user
  // has already clicked.
  React.useEffect(() => {
    if (envList.length === 0) return;
    if (effectiveDefault && envList.some((e) => e.id === effectiveDefault)) {
      setSelectedEnv(effectiveDefault);
      return;
    }
    setSelectedEnv((prev) => {
      if (prev && envList.some((e) => e.id === prev)) return prev;
      return envList[0]?.id ?? "";
    });
  }, [envList, effectiveDefault]);
  const [cpuCores, setCpuCores] = React.useState(
    snapSliderValue(dc?.cpuCores ?? 4, CPU_MIN, cpuMax, cpuStep),
  );
  const [ramGB, setRamGB] = React.useState(
    snapSliderValue(dc?.ramGB ?? 16, RAM_MIN, ramMax, ramStep),
  );
  const [storageGB, setStorageGB] = React.useState(
    snapSliderValue(dc?.storageGB ?? 128, STORAGE_MIN, storageMax, storageStep),
  );

  React.useEffect(() => {
    setCpuCores((prev) => snapSliderValue(prev, CPU_MIN, cpuMax, cpuStep));
    setRamGB((prev) => snapSliderValue(prev, RAM_MIN, ramMax, ramStep));
    setStorageGB((prev) =>
      snapSliderValue(prev, STORAGE_MIN, storageMax, storageStep),
    );
  }, [cpuMax, ramMax, storageMax, cpuStep, ramStep, storageStep]);

  const [name, setName] = React.useState(dc?.name ?? "");
  const [gitUrl, setGitUrl] = React.useState(dc?.gitUrl ?? "");
  // Env-var rows carry a stable `uid` so each row's local reveal state stays
  // bound to its own value. Keying the list by array index instead would let a
  // revealed-plaintext state migrate onto a different secret when a row above
  // it is removed.
  const envVarUidRef = React.useRef(0);
  const makeEnvVarRow = (key = "", value = ""): EnvVarRow => ({
    uid: `env-${envVarUidRef.current++}`,
    key,
    value,
  });
  const [envVars, setEnvVars] = React.useState<EnvVarRow[]>(() =>
    (dc?.envVars ?? [{ key: "", value: "" }]).map((e) =>
      makeEnvVarRow(e.key, e.value),
    ),
  );
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
        name,
        gitUrl,
        envVars: envVars
          .filter((e) => e.key.trim() !== "")
          .map(({ key, value }) => ({ key, value })),
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
    setCpuCores(snapSliderValue(cpu, CPU_MIN, cpuMax, cpuStep));
    setRamGB(snapSliderValue(ram, RAM_MIN, ramMax, ramStep));
    setStorageGB(snapSliderValue(storage, STORAGE_MIN, storageMax, storageStep));
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
  const hourlyCostBreakdown = computeHourlyCost(
    cpuCores,
    ramGB,
    storageGB,
    effectivePricingRates,
  );
  const hourCost = hourlyCostBreakdown.total.toFixed(2);

  // Per-second header derives from the raw float total, not the
  // already-rounded `hourCost`, so the header and the breakdown sum
  // stay in lockstep at 8-decimal precision.
  const displayValue =
    pricingView === "hourly"
      ? hourCost
      : formatPerSecondValue(hourlyCostBreakdown.total);
  const pricingSuffix = pricingView === "hourly" ? "/ hour" : "/ sec";
  const rateSuffix = pricingView === "hourly" ? "/h" : "/s";
  const fmtRate = (v: number) =>
    pricingView === "hourly" ? v.toFixed(2) : formatPerSecondValue(v);

  return (
    <div className={cn("max-w-6xl mx-auto flex flex-col", className)}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 shrink-0">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sandbox Provisioning
          </h1>
          <p className="text-muted-foreground text-sm">
            Select your stack, allocate resources, and deploy.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
        {/* Left: Configuration Form */}
        <div className="col-span-12 xl:col-span-8 flex flex-col min-h-0">
          {/* Load error */}
          {loadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 shrink-0 mb-4">
              <Info className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {loadError}
              </p>
            </div>
          )}

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
            {/* Section 1: Environment — only shown when there's a real choice */}
            {showEnvironmentSection && (
                <section className={SECTION_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Environment Selection
                    </h2>
                  </div>
                  {!isLoadingEnvironments && environments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No environments are available to select right now. Refresh
                      to try again.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {isLoadingEnvironments && environments.length === 0
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton placeholder
                            key={`env-skeleton-${i}`}
                            className="p-3.5 rounded-lg border border-border bg-card/50 animate-pulse"
                            aria-hidden="true"
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <div className="w-10 h-10 rounded-full bg-muted/60 border border-border" />
                              <div className="w-4 h-4 rounded-full border-2 border-border" />
                            </div>
                            <div className="h-3 w-1/3 rounded bg-muted/60 mb-2" />
                            <div className="h-2.5 w-5/6 rounded bg-muted/50 mb-1.5" />
                            <div className="h-2.5 w-2/3 rounded bg-muted/50" />
                          </div>
                        ))
                      : environments.map((env) => (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => setSelectedEnv(env.id)}
                        className={cn(
                          "group p-3.5 rounded-lg text-left border transition-colors duration-200",
                          selectedEnv === env.id
                            ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                            : "bg-surface-container border-[var(--md3-outline-variant)] hover:border-primary/30 active:scale-[0.99]",
                        )}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-high border border-[var(--md3-outline-variant)]">
                            {env.icon}
                          </div>
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-200",
                              selectedEnv === env.id
                                ? "border-primary bg-primary"
                                : "border-[var(--md3-outline-variant)] group-hover:border-primary/40",
                            )}
                          >
                            {selectedEnv === env.id && (
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm mb-0.5 text-foreground">
                          {env.name}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {env.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
            )}

                {/* Section 2: Resources */}
                <section className={SECTION_CARD_CLASS}>
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="h-4 w-4 text-primary shrink-0" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Resource Allocation
                    </h2>
                  </div>

                  <div className="mb-4">
                    <label className={cn(FIELD_LABEL_CLASS, "mb-2")}>
                      Compute Presets
                    </label>
                    <div className="grid grid-cols-3 gap-2">
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
                              "p-2.5 rounded-lg transition-colors duration-200 text-center group border relative",
                              active
                                ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                                : p.locked
                                  ? "bg-muted/30 border-border opacity-60 cursor-not-allowed"
                                  : "bg-surface-container border-[var(--md3-outline-variant)] hover:border-primary/30 active:scale-[0.99]",
                            )}
                          >
                            {p.locked && (
                              <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                {p.unlockLabel}
                              </div>
                            )}
                            <div
                              className={cn(
                                "font-semibold text-sm transition-colors duration-200",
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

                  <div className="space-y-4">
                    {[
                      {
                        label: "Compute Cores (CPU)",
                        value: cpuCores,
                        setter: setCpuCores,
                        min: CPU_MIN,
                        max: cpuMax,
                        step: cpuStep,
                        unit: "vCPU",
                      },
                      {
                        label: "Memory (RAM)",
                        value: ramGB,
                        setter: setRamGB,
                        min: RAM_MIN,
                        max: ramMax,
                        step: ramStep,
                        unit: "GB",
                      },
                      {
                        label: "Ephemeral Storage",
                        value: storageGB,
                        setter: setStorageGB,
                        min: STORAGE_MIN,
                        max: storageMax,
                        step: storageStep,
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
                            <div className="flex justify-between items-end pb-1 mb-1.5">
                              <label className={FIELD_LABEL_CLASS}>
                                {label}
                              </label>
                              <span className="text-sm font-semibold text-foreground tabular-nums">
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
                              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-runnable-track]:bg-border [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-moz-range-track]:bg-border [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-foreground"
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

                {/* Advanced workspace options (collapsed by default) */}
                <section className={SECTION_CARD_CLASS}>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium focus:outline-none"
                    >
                      <Settings className="w-4 h-4" />
                      {showAdvanced
                        ? "Hide Advanced Options"
                        : "Show Advanced Options"}
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={cn(FIELD_LABEL_CLASS, "mb-1.5")}>
                              Workspace Name
                            </label>
                            <Input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              maxLength={128}
                              className="h-9 px-3 text-sm"
                              placeholder="my-cool-sandbox"
                            />
                          </div>
                          <div>
                            <label className={cn(FIELD_LABEL_CLASS, "mb-1.5")}>
                              Virtualization Driver
                            </label>
                            <Select
                              value={driver}
                              onValueChange={(value) => {
                                if (VALID_DRIVERS.has(value))
                                  setDriver(
                                    value as ProvisioningConfig["driver"],
                                  );
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="docker">
                                  Docker container (Default)
                                </SelectItem>
                                <SelectItem value="firecracker">
                                  Firecracker microVM (Secure)
                                </SelectItem>
                                <SelectItem value="tangle">
                                  Tangle Distributed Node
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <label className={cn(FIELD_LABEL_CLASS, "mb-1.5")}>
                            Git Repository URL
                          </label>
                          <Input
                            type="text"
                            value={gitUrl}
                            onChange={(e) => setGitUrl(e.target.value)}
                            className="h-9 px-3 text-sm"
                            placeholder="https://github.com/my-org/my-repo.git"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className={FIELD_LABEL_CLASS}>
                              Environment Variables
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setEnvVars([...envVars, makeEnvVarRow()])
                              }
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors font-medium"
                            >
                              <Plus className="h-3 w-3" /> Add Var
                            </button>
                          </div>
                          <div className="space-y-2">
                            {envVars.map((env) => (
                              <div key={env.uid} className="flex gap-2">
                                <Input
                                  type="text"
                                  value={env.key}
                                  onChange={(e) =>
                                    setEnvVars(
                                      envVars.map((v) =>
                                        v.uid === env.uid
                                          ? { ...v, key: e.target.value }
                                          : v,
                                      ),
                                    )
                                  }
                                  className="flex-1 h-9 px-3 font-mono text-sm"
                                  placeholder="API_KEY"
                                />
                                <EnvVarValueInput
                                  value={env.value}
                                  onChange={(value) =>
                                    setEnvVars(
                                      envVars.map((v) =>
                                        v.uid === env.uid ? { ...v, value } : v,
                                      ),
                                    )
                                  }
                                  placeholder="sk-xxxxxxxxxxx"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  aria-label="Remove variable"
                                  onClick={() =>
                                    setEnvVars(
                                      envVars.filter((v) => v.uid !== env.uid),
                                    )
                                  }
                                  className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {envVars.length === 0 && (
                              <div className="text-center p-3 border border-dashed border-[var(--md3-outline-variant)] rounded-lg text-muted-foreground/60 text-xs italic">
                                No environment variables set
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Startup Scripts */}
                        {availableScripts.length > 0 && (
                          <div>
                            <div className={cn(FIELD_LABEL_CLASS, "mb-1.5")}>
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
                                      className="flex items-start gap-3 cursor-pointer group rounded-lg border border-[var(--md3-outline-variant)] p-3 transition-colors hover:border-primary/30"
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
                                        className="mt-0.5 h-4 w-4 rounded border-[var(--md3-outline-variant)] text-primary focus:ring-primary/30"
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
                                                className="inline-flex items-center gap-0.5 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-muted-foreground"
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

                        <div className="pt-3 border-t border-[var(--md3-outline-variant)] flex items-start justify-between gap-3">
                          <div>
                            <label
                              htmlFor="wizard-bare-mode"
                              className="block text-sm font-medium text-foreground cursor-pointer"
                            >
                              Bare Mode
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Start as a raw container without an embedded AI
                              Agent backend.
                            </p>
                          </div>
                          <Switch
                            id="wizard-bare-mode"
                            checked={bare}
                            onCheckedChange={setBare}
                            className="mt-0.5"
                          />
                        </div>

                        {sshAccess && (
                          <div className="pt-3 border-t border-[var(--md3-outline-variant)]">
                            <SshAccessStep config={sshAccess} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
          </div>
        </div>

        {/* Right: Cost estimator */}
        <div className="col-span-12 xl:col-span-4 sticky top-4 space-y-4">
          {/* Cost card */}
          <div className="rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className={FIELD_LABEL_CLASS}>Run Cost</span>
              <div
                role="group"
                aria-label="Pricing view"
                className="inline-flex items-center rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-low p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={pricingView === "hourly"}
                  onClick={() => setPricingView("hourly")}
                  className={cn(
                    "rounded px-2.5 py-0.5 text-[10px] font-medium transition-all",
                    pricingView === "hourly"
                      ? "bg-surface-container-high text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Per Hour
                </button>
                <button
                  type="button"
                  aria-pressed={pricingView === "perSecond"}
                  onClick={() => setPricingView("perSecond")}
                  className={cn(
                    "rounded px-2.5 py-0.5 text-[10px] font-medium transition-all",
                    pricingView === "perSecond"
                      ? "bg-surface-container-high text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Per Second
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span
                key={pricingView}
                className={cn(
                  "font-semibold text-foreground tracking-tight tabular-nums animate-in fade-in duration-200",
                  pricingView === "hourly" ? "text-3xl" : "text-xl",
                )}
              >
                ${displayValue}
              </span>
              <span className="text-muted-foreground text-sm">
                {pricingSuffix}
              </span>
            </div>
            <div className="space-y-2 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-high p-3">
              <div className="flex justify-between text-xs font-mono tracking-wide text-muted-foreground">
                <span>COMPUTE</span>
                <span className="text-foreground">
                  ${fmtRate(hourlyCostBreakdown.compute)}
                  {rateSuffix}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono tracking-wide text-muted-foreground">
                <span>MEMORY</span>
                <span className="text-foreground/80">
                  ${fmtRate(hourlyCostBreakdown.memory)}
                  {rateSuffix}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono tracking-wide text-muted-foreground">
                <span>STORAGE</span>
                <span className="text-foreground/80">
                  ${fmtRate(hourlyCostBreakdown.storage)}
                  {rateSuffix}
                </span>
              </div>
              {hourlyCostBreakdown.floorApplies && (
                <div className="flex justify-between text-xs font-mono tracking-wide text-primary border-t border-[var(--md3-outline-variant)] pt-2">
                  <span>MIN CHARGE</span>
                  <span>
                    $
                    {fmtRate(
                      hourlyCostBreakdown.floor -
                        hourlyCostBreakdown.lineSum,
                    )}
                    {rateSuffix}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Deploy error */}
          {deployError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {deployError}
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleDeploy}
              disabled={isDeploying || !selectedEnv}
              className="w-full"
            >
              {isDeploying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Spinning up environment...
                </span>
              ) : (
                "Deploy Workspace"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

