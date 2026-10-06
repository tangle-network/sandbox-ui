// Provisioning request and pricing shapes shared by sandbox provisioning UIs.

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
  driver: "docker" | "firecracker" | "host-agent" | "tangle";
  bare: boolean;
  startupScriptIds?: string[];
}
