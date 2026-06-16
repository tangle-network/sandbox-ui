import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ProvisioningWizard,
  resolveEnvironment,
  formatPerSecondValue,
  alignSliderStep,
  snapSliderValue,
  type ProvisioningConfig,
  type StartupScriptEntry,
  type EnvironmentEntry,
  type SshAccessConfig,
  type SshKeyOption,
} from "./provisioning-wizard"

function makeScript(overrides: Partial<StartupScriptEntry> = {}): StartupScriptEntry {
  return {
    id: "script-1",
    name: "Install Claude Code",
    description: "Install CLI tool",
    enabled: true,
    injectSecrets: [],
    ...overrides,
  }
}

function makeSshKey(overrides: Partial<SshKeyOption> = {}): SshKeyOption {
  return {
    id: "key-1",
    name: "Laptop",
    keyType: "ssh-ed25519",
    fingerprint: "SHA256:abc",
    ...overrides,
  }
}

function makeSshAccess(overrides: Partial<SshAccessConfig> = {}): SshAccessConfig {
  return {
    keys: [],
    selectedKeyIds: [],
    inlinePublicKeys: "",
    onSelectedKeyIdsChange: vi.fn(),
    onInlinePublicKeysChange: vi.fn(),
    ...overrides,
  }
}

const VALID_PUBLIC_KEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIabcd1234 test@example"

// SSH access and the other advanced fields live inside the collapsible
// "Advanced Options" drawer (single-page wizard). Tests that exercise those
// controls open the drawer first.
async function openAdvanced() {
  await userEvent.click(screen.getByText("Show Advanced Options"))
}


describe("ProvisioningWizard — startup scripts integration", () => {
  it("renders environment, resources, and access together as one page (no stepper)", async () => {
    render(
      <ProvisioningWizard
        variant="multistep"
        sshAccess={{
          keys: [
            {
              id: "key-1",
              name: "Laptop",
              keyType: "ssh-ed25519",
              fingerprint: "SHA256:abc",
            },
          ],
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    // Even with variant="multistep", every section renders together and
    // no stepper navigation is required.
    expect(screen.queryByText(/continue to/i)).not.toBeInTheDocument()
    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(screen.getByText("Resource Allocation")).toBeInTheDocument()
    // SSH access lives in the Advanced Options drawer on the same page.
    await openAdvanced()
    expect(screen.getByText("SSH Access")).toBeInTheDocument()
    expect(screen.getByText("Laptop")).toBeInTheDocument()
  })

  it("renders the access section with SSH keys as one page when pre-configured via template", async () => {
    render(
      <ProvisioningWizard
        variant="multistep"
        defaultConfig={{
          cpuCores: 1,
          ramGB: 4,
          storageGB: 30,
          environment: "node",
          name: "",
          gitUrl: "",
          envVars: [],
          driver: "docker",
          bare: false,
        }}
        skipToReview
        sshAccess={{
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    // No stepper / Continue navigation — the access section is reachable on
    // the same page via the Advanced Options drawer.
    expect(screen.queryByText(/continue to/i)).not.toBeInTheDocument()
    await openAdvanced()
    expect(screen.getByText("SSH Access")).toBeInTheDocument()
  })

  it("loads and renders startup scripts on mount", async () => {
    const scripts = [
      makeScript({ id: "s1", name: "Setup SSH", description: "Configure SSH keys" }),
      makeScript({ id: "s2", name: "Install Deps", description: "npm install" }),
    ]
    const onLoadStartupScripts = vi.fn().mockResolvedValue(scripts)

    render(
      <ProvisioningWizard
        onLoadStartupScripts={onLoadStartupScripts}
        variant="flat"
      />,
    )

    expect(onLoadStartupScripts).toHaveBeenCalledOnce()

    // Open advanced options to see scripts
    await userEvent.click(screen.getByText("Show Advanced Options"))

    await waitFor(() => {
      expect(screen.getByText("Setup SSH")).toBeInTheDocument()
    })
    expect(screen.getByText("Install Deps")).toBeInTheDocument()
  })

  it("does not render scripts section when onLoadStartupScripts is not provided", async () => {
    render(<ProvisioningWizard variant="flat" />)

    await userEvent.click(screen.getByText("Show Advanced Options"))

    // "Startup Scripts" label should not appear
    expect(screen.queryByText("Startup Scripts")).not.toBeInTheDocument()
  })

  it("only renders enabled scripts", async () => {
    const scripts = [
      makeScript({ id: "s1", name: "Enabled Script", enabled: true }),
      makeScript({ id: "s2", name: "Disabled Script", enabled: false }),
    ]
    const onLoadStartupScripts = vi.fn().mockResolvedValue(scripts)

    render(
      <ProvisioningWizard
        onLoadStartupScripts={onLoadStartupScripts}
        variant="flat"
      />,
    )

    await userEvent.click(screen.getByText("Show Advanced Options"))

    await waitFor(() => {
      expect(screen.getByText("Enabled Script")).toBeInTheDocument()
    })
    expect(screen.queryByText("Disabled Script")).not.toBeInTheDocument()
  })

  it("toggles script selection via checkbox", async () => {
    const user = userEvent.setup()
    const scripts = [makeScript({ id: "s1", name: "My Script" })]
    const onLoadStartupScripts = vi.fn().mockResolvedValue(scripts)

    render(
      <ProvisioningWizard
        onLoadStartupScripts={onLoadStartupScripts}
        variant="flat"
      />,
    )

    await user.click(screen.getByText("Show Advanced Options"))

    await waitFor(() => {
      expect(screen.getByText("My Script")).toBeInTheDocument()
    })

    const scriptCheckbox = screen.getByRole("checkbox", { name: /my script/i })
    expect(scriptCheckbox).not.toBeChecked()

    await user.click(scriptCheckbox)
    expect(scriptCheckbox).toBeChecked()

    await user.click(scriptCheckbox)
    expect(scriptCheckbox).not.toBeChecked()
  })

  it("includes selected scripts in onSubmit config", async () => {
    const user = userEvent.setup()
    const scripts = [
      makeScript({ id: "s1", name: "Script A" }),
      makeScript({ id: "s2", name: "Script B" }),
    ]
    const onLoadStartupScripts = vi.fn().mockResolvedValue(scripts)
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        onLoadStartupScripts={onLoadStartupScripts}
        onSubmit={onSubmit}
        variant="flat"
      />,
    )

    await user.click(screen.getByText("Show Advanced Options"))

    await waitFor(() => {
      expect(screen.getByText("Script A")).toBeInTheDocument()
    })

    // Select only Script A
    const checkboxes = screen.getAllByRole("checkbox")
    // First checkbox is Script A, second is Script B, last one is Bare Mode toggle (sr-only)
    await user.click(checkboxes[0])

    // Click deploy
    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.startupScriptIds).toEqual(["s1"])
  })

  it("shows deploy error when onSubmit rejects", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error("Quota exceeded"))

    render(
      <ProvisioningWizard
        onSubmit={onSubmit}
        variant="flat"
      />,
    )

    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(screen.getByText("Quota exceeded")).toBeInTheDocument()
    })
  })

  it("shows load error when onLoadStartupScripts fails", async () => {
    const onLoadStartupScripts = vi.fn().mockRejectedValue(new Error("Network timeout"))

    render(
      <ProvisioningWizard
        onLoadStartupScripts={onLoadStartupScripts}
        variant="flat"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Network timeout")).toBeInTheDocument()
    })
  })

  it("does not call onSubmit when onSubmit prop is undefined", async () => {
    const user = userEvent.setup()
    render(<ProvisioningWizard variant="flat" />)

    // Deploy button should not crash when clicked without onSubmit
    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

    // No error should appear — handleDeploy returns early
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })
})

describe("ProvisioningWizard — one-page layout (issue #79)", () => {
  it("renders environment, resources, advanced, and access sections together without a stepper", async () => {
    render(
      <ProvisioningWizard
        variant="multistep"
        sshAccess={{
          keys: [
            { id: "k1", name: "Laptop", keyType: "ssh-ed25519", fingerprint: "SHA256:aa" },
          ],
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    // Environment + resources render up front; access lives in the Advanced
    // Options drawer on the same page — no step navigation needed.
    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(screen.getByText("Resource Allocation")).toBeInTheDocument()
    expect(screen.getByText("Show Advanced Options")).toBeInTheDocument()
    await openAdvanced()
    expect(screen.getByText("SSH Access")).toBeInTheDocument()
    // Deploy is reachable immediately in the summary panel.
    expect(
      screen.getByRole("button", { name: /deploy workspace/i }),
    ).toBeInTheDocument()
    // No stepper affordances.
    expect(screen.queryByText("Continue to Resources")).not.toBeInTheDocument()
    expect(screen.queryByText("Continue to Access")).not.toBeInTheDocument()
    expect(screen.queryByText("Start from scratch")).not.toBeInTheDocument()
  })

  it("omits the access section when sshAccess is not provided", async () => {
    render(<ProvisioningWizard variant="multistep" />)

    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(screen.getByText("Resource Allocation")).toBeInTheDocument()
    // Even inside the advanced drawer there's no SSH section without sshAccess.
    await openAdvanced()
    expect(screen.queryByText("SSH Access")).not.toBeInTheDocument()
  })

  it("preserves the back action and cost summary in one-page mode", () => {
    const onBack = vi.fn()
    render(
      <ProvisioningWizard
        variant="multistep"
        onBack={onBack}
        sshAccess={{
          keys: [],
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText("Run Cost")).toBeInTheDocument()
    expect(screen.getByText("Sandbox Provisioning")).toBeInTheDocument()
  })
})

describe("ProvisioningWizard — SSH key selection (issue #79)", () => {
  it("marks a selected SSH key with aria-pressed and a visible non-color cue", async () => {
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="multistep"
        sshAccess={{
          keys: [
            { id: "k1", name: "Laptop", keyType: "ssh-ed25519", fingerprint: "SHA256:aa" },
            { id: "k2", name: "Desktop", keyType: "ssh-rsa", fingerprint: "SHA256:bb" },
          ],
          selectedKeyIds: ["k1"],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange,
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    await openAdvanced()
    const laptopBtn = screen.getByText("Laptop").closest("button") as HTMLButtonElement
    const desktopBtn = screen.getByText("Desktop").closest("button") as HTMLButtonElement

    // ARIA state reflects selection for assistive tech.
    expect(laptopBtn).toHaveAttribute("aria-pressed", "true")
    expect(desktopBtn).toHaveAttribute("aria-pressed", "false")

    // Non-color cue: only the selected key's button carries the selected
    // styling (ring + primary border) AND renders a check glyph, while the
    // unselected one does not.
    expect(laptopBtn.className).toContain("ring-1")
    expect(laptopBtn.className).toContain("ring-primary/20")
    expect(desktopBtn.className).toContain("border-border")
    expect(desktopBtn.className).not.toContain("ring-1")

    // The check icon is the non-color affordance — it only appears for the
    // selected key.
    const laptopSvg = laptopBtn.querySelectorAll("svg")
    const desktopSvg = desktopBtn.querySelectorAll("svg")
    expect(laptopSvg.length).toBeGreaterThan(desktopSvg.length)
  })

  it("keeps the selected key name and fingerprint readable on the selected background", async () => {
    render(
      <ProvisioningWizard
        variant="multistep"
        sshAccess={{
          keys: [
            { id: "k1", name: "Laptop", keyType: "ssh-ed25519", fingerprint: "SHA256:abcd1234" },
          ],
          selectedKeyIds: ["k1"],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    // The name and fingerprint text are present and legible regardless of
    // selection state — they use foreground tokens, not the gradient bg.
    await openAdvanced()
    const laptopBtn = screen.getByText("Laptop").closest("button") as HTMLButtonElement
    expect(laptopBtn).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("ssh-ed25519 · SHA256:abcd1234")).toBeInTheDocument()
    // Foreground-readable text classes must be present on the selected key.
    expect(laptopBtn.innerHTML).toContain("text-foreground")
  })

  it("toggles SSH key selection and preserves the deploy payload shape", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="multistep"
        onSubmit={onSubmit}
        sshAccess={{
          keys: [
            { id: "k1", name: "Laptop", keyType: "ssh-ed25519", fingerprint: "SHA256:aa" },
          ],
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange,
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    // Selecting the key propagates to the controlled handler.
    await openAdvanced()
    const laptopBtn = screen.getByText("Laptop").closest("button") as HTMLButtonElement
    await userEvent.click(laptopBtn)
    expect(onSelectedKeyIdsChange).toHaveBeenCalledWith(["k1"])

    // Deploy still fires and the submit payload keeps its existing shape
    // (no new SSH fields leaked into ProvisioningConfig).
    await userEvent.click(screen.getByRole("button", { name: /deploy workspace/i }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(Object.keys(config).sort()).toEqual(
      [
        "bare",
        "cpuCores",
        "driver",
        "environment",
        "envVars",
        "gitUrl",
        "name",
        "ramGB",
        "startupScriptIds",
        "storageGB",
      ].sort(),
    )
  })
})

describe("resolveEnvironment", () => {
  it("resolves a known stack ID to its display info", () => {
    const entry: EnvironmentEntry = { id: "ethereum", description: "Ethereum dev env" }
    const result = resolveEnvironment(entry)
    expect(result.id).toBe("ethereum")
    expect(result.name).toBe("Ethereum")
    expect(result.description).toBe("Ethereum dev env")
  })

  it("resolves an unknown stack ID with fallback formatting", () => {
    const entry: EnvironmentEntry = { id: "my-custom-stack" }
    const result = resolveEnvironment(entry)
    expect(result.id).toBe("my-custom-stack")
    expect(result.name).toBe("My custom stack")
    expect(result.color).toBe("slate")
  })

  it("resolves a template: prefixed ID as a user template", () => {
    const entry: EnvironmentEntry = { id: "template:abc-123", description: "Template: My Snapshot" }
    const result = resolveEnvironment(entry)
    expect(result.id).toBe("template:abc-123")
    expect(result.name).toBe("My Snapshot")
    expect(result.color).toBe("green")
  })

  it("handles template: ID without description gracefully", () => {
    const entry: EnvironmentEntry = { id: "template:xyz" }
    const result = resolveEnvironment(entry)
    expect(result.name).toBe("Custom Template")
    expect(result.description).toBe("User template from snapshot")
  })
})

describe("ProvisioningWizard — resourceLimits", () => {
  it("clamps default state values to resourceLimits", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        variant="flat"
        onSubmit={onSubmit}
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // Deploy immediately without touching sliders — defaults should be clamped
    await userEvent.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.cpuCores).toBeLessThanOrEqual(2)
    expect(config.ramGB).toBeLessThanOrEqual(8)
    expect(config.storageGB).toBeLessThanOrEqual(64)
  })

  it("locked presets are disabled and clicking them does not apply their values", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        variant="flat"
        onSubmit={onSubmit}
        // 2 vCPU / 8 GB / 64 GB leaves Lightweight (2/4/50) as the only
        // fitting preset; Standard (4/16/128) and Performance (8/32/256)
        // both exceed it, so they must be rendered disabled.
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    const standardBtn = screen.getByText("Standard").closest("button")
    const performanceBtn = screen.getByText("Performance").closest("button")
    expect(standardBtn).toBeDisabled()
    expect(performanceBtn).toBeDisabled()
    // Lightweight fits, so it should remain interactive and auto-selected.
    const lightweightBtn = screen.getByText("Lightweight").closest("button")
    expect(lightweightBtn).not.toBeDisabled()

    // Clicking a locked preset must not apply its raw values (the onClick
    // handler short-circuits on `p.locked` AND the button is disabled so
    // the click is swallowed by the browser).
    await user.click(screen.getByText("Performance"))

    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    // Sliders still obey the user's limits — the disabled click was a no-op.
    expect(config.cpuCores).toBeLessThanOrEqual(2)
    expect(config.ramGB).toBeLessThanOrEqual(8)
    expect(config.storageGB).toBeLessThanOrEqual(64)
    // And the click to Performance did NOT succeed in bumping the sliders
    // up to the preset's raw values.
    expect(config.cpuCores).toBeLessThan(8)
    expect(config.ramGB).toBeLessThan(32)
    expect(config.storageGB).toBeLessThan(256)
  })

  it("clamps default config values to resourceLimits as one page", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        variant="multistep"
        onSubmit={onSubmit}
        defaultConfig={{ cpuCores: 1, ramGB: 4, storageGB: 30, environment: "node", name: "", gitUrl: "", envVars: [], driver: "docker", bare: false }}
        skipToReview
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // No stepper navigation is present; deploy is immediately available.
    expect(screen.queryByText(/continue to/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.cpuCores).toBeLessThanOrEqual(2)
    expect(config.ramGB).toBeLessThanOrEqual(8)
    expect(config.storageGB).toBeLessThanOrEqual(64)
  })

  it("slider max reflects resourceLimits", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    const sliders = screen.getAllByRole("slider")
    // CPU slider max should be capped at 2
    expect(sliders[0]).toHaveAttribute("max", "2")
    // RAM slider max should be capped at 8
    expect(sliders[1]).toHaveAttribute("max", "8")
    // Storage slider max should be capped at 64
    expect(sliders[2]).toHaveAttribute("max", "64")
  })

  it("cost display includes storage in calculation", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 2, ramMaxGB: 4, storageMaxGB: 20 }}
      />,
    )

    // With clamped defaults (cpu=2, ram=4, storage=20):
    // cost = 2*0.045 + 4*0.005 + 20*0.0011 = 0.09 + 0.02 + 0.022 = 0.132 → "0.13"
    expect(screen.getByText("$0.13")).toBeInTheDocument()
  })

  it("enforces lower-bound on resourceLimits so slider min never exceeds max", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 0.1, ramMaxGB: 1, storageMaxGB: 5 }}
      />,
    )

    const sliders = screen.getAllByRole("slider")
    // cpuMax should be clamped up to CPU_MIN (0.5), not 0.1
    expect(Number(sliders[0].getAttribute("max"))).toBeGreaterThanOrEqual(Number(sliders[0].getAttribute("min")))
    // ramMax should be clamped up to RAM_MIN (2), not 1
    expect(Number(sliders[1].getAttribute("max"))).toBeGreaterThanOrEqual(Number(sliders[1].getAttribute("min")))
    // storageMax should be clamped up to STORAGE_MIN (20), not 5
    expect(Number(sliders[2].getAttribute("max"))).toBeGreaterThanOrEqual(Number(sliders[2].getAttribute("min")))
  })

  it("preset labels always show their real unclamped values", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // The wizard renders every preset with its real specs regardless of
    // the caller's limits — out-of-range rows are disabled and badged
    // with an upsell tier rather than silently rewritten to the user's
    // max. This makes the "Pro plan unlocks more" story visible.
    expect(screen.getByText("2 vCPUs / 4GB / 50GB")).toBeInTheDocument()
    expect(screen.getByText("4 vCPUs / 16GB / 128GB")).toBeInTheDocument()
    expect(screen.getByText("8 vCPUs / 32GB / 256GB")).toBeInTheDocument()
  })
})

describe("ProvisioningWizard — pricingRates", () => {
  it("computes the hourly total from caller-supplied rates", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        // Limits kept tiny so sliders start at predictable values: 1 vCPU / 2 GB / 20 GB.
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 20 }}
        pricingRates={{
          cpuPerHr: 0.1,
          ramPerGbHr: 0.02,
          diskPerGbHr: 0.001,
          minChargePerHr: 0,
        }}
      />,
    )
    // 1 * 0.1 + 2 * 0.02 + 20 * 0.001 = 0.10 + 0.04 + 0.02 = 0.16
    expect(screen.getByText("$0.16")).toBeInTheDocument()
  })

  it("honours minChargePerHr as a floor and surfaces the difference as a MIN CHARGE row", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 20 }}
        pricingRates={{
          cpuPerHr: 0.01,
          ramPerGbHr: 0.001,
          diskPerGbHr: 0.0001,
          // Lines sum to 0.01 + 0.002 + 0.002 = 0.014 → well below 1.00
          minChargePerHr: 1.0,
        }}
      />,
    )
    // Header total reflects the floor…
    expect(screen.getByText("$1.00")).toBeInTheDocument()
    // …and the breakdown surfaces the floor contribution explicitly so
    // line items + MIN CHARGE = total.
    expect(screen.getByText("MIN CHARGE")).toBeInTheDocument()
  })

  it("does not render MIN CHARGE when the line sum already clears the floor", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 20 }}
        pricingRates={{
          cpuPerHr: 0.1,
          ramPerGbHr: 0.02,
          diskPerGbHr: 0.001,
          minChargePerHr: 0.01, // line sum (0.16) >> floor
        }}
      />,
    )
    expect(screen.queryByText("MIN CHARGE")).not.toBeInTheDocument()
  })
})

describe("alignSliderStep", () => {
  it("keeps the desired step when (max - min) is already a multiple of it", () => {
    // Pro-tier storage: 20 → 256, step 8. 236 / 8 = 29.5 → the desired
    // step does NOT actually divide this range, so we expect a reduced
    // step. Use a case where it does: 20 → 100, step 8 → 80 / 8 = 10.
    expect(alignSliderStep(20, 100, 8)).toBe(8)
    expect(alignSliderStep(0.5, 8, 0.5)).toBe(0.5)
    expect(alignSliderStep(2, 32, 1)).toBe(1)
  })

  it("reduces the step so the max is reachable when the range is not step-aligned", () => {
    // The bug from issue #738: STORAGE_MIN=20, plan max=50, step=8.
    // 30 is not a multiple of 8, so the browser caps the thumb at 44.
    // Largest divisor of 30 that is ≤ 8 is 6, so the step must fall to 6.
    expect(alignSliderStep(20, 50, 8)).toBe(6)
    // Same structural case for RAM: plan max=5, min=2, step=1 → range 3.
    // 3 % 1 == 0 already, so no adjustment.
    expect(alignSliderStep(2, 5, 1)).toBe(1)
    // 0.5-step CPU where the plan cap lands on a half-integer the default
    // step cannot reach: 0.5 → 0.7, step 0.5. range 0.2, divisor 0.2.
    expect(alignSliderStep(0.5, 0.7, 0.5)).toBeCloseTo(0.2)
  })

  it("returns the desired step when range is zero (single-value slider)", () => {
    // Free-tier RAM: min=2, plan max=2. The slider has no travel, so the
    // step is irrelevant and we keep the caller's value.
    expect(alignSliderStep(2, 2, 1)).toBe(1)
    expect(alignSliderStep(0.5, 0.5, 0.5)).toBe(0.5)
  })

  it("falls back to the desired step when no smaller divisor exists", () => {
    // range=7 (prime), desired=8. Divisors of 7 are {1, 7}. Largest ≤ 8
    // is 7, not 1: the helper should pick 7. We still want the thumb to
    // reach max, so "7" is the right answer even though it's a weird step.
    expect(alignSliderStep(0, 7, 8)).toBe(7)
  })

  it("returns the desired step unchanged for degenerate inputs", () => {
    // Non-positive desiredStep is echoed back so bad caller input cannot
    // silently invent a step; likewise a negative range (max < min) is a
    // caller bug and should not be silently "fixed".
    expect(alignSliderStep(0, 10, 0)).toBe(0)
    expect(alignSliderStep(10, 5, 8)).toBe(8)
  })
})

describe("snapSliderValue", () => {
  it("leaves values that already sit on the grid alone", () => {
    // Storage: grid {20, 26, 32, ..., 50} (step 6 from alignSliderStep
    // for a 20→50 range). 26 and 50 are both stops, so both echo back.
    expect(snapSliderValue(26, 20, 50, 6)).toBe(26)
    expect(snapSliderValue(50, 20, 50, 6)).toBe(50)
    expect(snapSliderValue(20, 20, 50, 6)).toBe(20)
  })

  it("snaps off-grid values to the nearest stop (the #738 follow-up bug)", () => {
    // Saved config storageGB=28 under old step-8 grid, loaded into a new
    // step-6 grid. Nearest stop to 28 is 26 (|28-26|=2 vs |28-32|=4).
    expect(snapSliderValue(28, 20, 50, 6)).toBe(26)
    // Halfway between stops: Math.round ties away from zero, so 29 is
    // closer to 32 than to 26 only by 3 vs 3 → rounds up.
    expect(snapSliderValue(29, 20, 50, 6)).toBe(32)
  })

  it("clamps values outside [min, max] before snapping", () => {
    // Preset storage=128 with plan storageMax=50 — clamp first, then the
    // snap is a no-op because max is guaranteed on-grid by alignSliderStep.
    expect(snapSliderValue(128, 20, 50, 6)).toBe(50)
    // Below min: clamp up to min, which is trivially on-grid.
    expect(snapSliderValue(5, 20, 50, 6)).toBe(20)
  })

  it("handles 0.5-step CPU grids without floating-point drift", () => {
    // CPU grid: {0.5, 1, 1.5, ..., 8}. 3.3 snaps to 3.5 (closer than 3.0).
    expect(snapSliderValue(3.3, 0.5, 8, 0.5)).toBe(3.5)
    // Exact half-integer stays put.
    expect(snapSliderValue(4, 0.5, 8, 0.5)).toBe(4)
  })

  it("returns safe fallbacks for degenerate inputs", () => {
    // NaN input — a non-finite seed must not poison state; fall back to min.
    expect(snapSliderValue(Number.NaN, 20, 50, 6)).toBe(20)
    // Zero/negative step — skip the snap math but still clamp to bounds.
    expect(snapSliderValue(42, 20, 50, 0)).toBe(42)
    expect(snapSliderValue(999, 20, 50, 0)).toBe(50)
  })
})

describe("ProvisioningWizard — slider step alignment (issue #738)", () => {
  it("storage slider's step divides its range so the thumb can reach max", () => {
    // Free tier limits reproduce the original bug: max=50, step=8 caps
    // the thumb at 44 unless the component re-aligns the step.
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 50 }}
      />,
    )
    const sliders = screen.getAllByRole("slider")
    const storage = sliders[2]
    const min = Number(storage.getAttribute("min"))
    const max = Number(storage.getAttribute("max"))
    const step = Number(storage.getAttribute("step"))
    expect(max).toBe(50)
    expect(min).toBe(20)
    // Range must be exactly divisible by step so the labelled max is
    // actually reachable.
    expect((max - min) % step).toBe(0)
  })

  it("all three sliders expose a step that divides their visible range", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 50 }}
      />,
    )
    const sliders = screen.getAllByRole("slider")
    for (const slider of sliders) {
      const min = Number(slider.getAttribute("min"))
      const max = Number(slider.getAttribute("max"))
      const step = Number(slider.getAttribute("step"))
      if (max === min) continue // single-value slider — step is moot
      // Scale to integers to avoid float modulo noise (smallest step 0.5).
      const scaledRange = Math.round((max - min) * 10)
      const scaledStep = Math.round(step * 10)
      expect(scaledRange % scaledStep).toBe(0)
    }
  })
})

describe("formatPerSecondValue", () => {
  it("formats zero with a stable 8-decimal width", () => {
    expect(formatPerSecondValue(0)).toBe("0.00000000")
  })

  it("converts an hourly value to a per-second rate", () => {
    // 3600 / 3600 == 1
    expect(formatPerSecondValue(3600)).toBe("1.00000000")
  })

  it("preserves precision past the 2-decimal hourly rounding", () => {
    // 4 * 0.045 + 16 * 0.005 + 128 * 0.0011 = 0.4008
    // The buggy code path used parseFloat("0.40") / 3600 = 0.00011111…
    // The correct value is 0.4008 / 3600 = 0.00011133…
    expect(formatPerSecondValue(0.4008)).toBe("0.00011133")
  })

  it("rounds values smaller than the 8-decimal floor down to zero", () => {
    // Documents the silent-zero edge case: rates beneath ~3.6e-5 / hr fall
    // off the per-second display entirely. Acceptable for plausible billing
    // tiers; flagged here so any future precision bump is intentional.
    expect(formatPerSecondValue(1e-5)).toBe("0.00000000")
  })
})

describe("ProvisioningWizard — pricing view toggle", () => {
  it("renders header and breakdown in per-second mode without arithmetic drift", async () => {
    render(
      <ProvisioningWizard
        variant="flat"
        // Limits chosen so the wizard auto-selects the Standard preset
        // (4 vCPU / 16 GB / 128 GB), reproducing the 0.4008/hr case where
        // toFixed(2) rounding silently corrupts the per-second header.
        resourceLimits={{ cpuMax: 4, ramMaxGB: 16, storageMaxGB: 128 }}
        pricingRates={{
          cpuPerHr: 0.045,
          ramPerGbHr: 0.005,
          diskPerGbHr: 0.0011,
          minChargePerHr: 0,
        }}
      />,
    )

    // Hourly view starts as the default.
    expect(screen.getByText("$0.40")).toBeInTheDocument()
    expect(screen.getByText("/ hour")).toBeInTheDocument()

    const perSecButton = screen.getByRole("button", {
      name: "Per Second",
      pressed: false,
    })
    await userEvent.click(perSecButton)

    // Header now reflects the *raw* total / 3600, not parseFloat("0.40") / 3600.
    expect(screen.getByText("$0.00011133")).toBeInTheDocument()
    expect(screen.getByText("/ sec")).toBeInTheDocument()

    // Each line item derives from the same raw float / 3600 path as the
    // header, so rounding drift is bounded to ±1 at the 8th decimal place —
    // far smaller than the previously-broken parseFloat("0.40") / 3600 path.
    expect(screen.getByText("$0.00005000/s")).toBeInTheDocument()
    expect(screen.getByText("$0.00002222/s")).toBeInTheDocument()
    expect(screen.getByText("$0.00003911/s")).toBeInTheDocument()

    // aria-pressed flips so screen readers can announce the active view.
    expect(perSecButton).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Per Hour", pressed: false }),
    ).toBeInTheDocument()
  })

  it("renders the MIN CHARGE row in per-second mode using the floor-minus-lineSum value", async () => {
    // Limits pin the sliders to 2 vCPU / 4 GB / 40 GB so the three line
    // products are each distinct (0.022 / 0.012 / 0.016 per hour) and the
    // line sum (0.05/hr) is well below the 1.0/hr floor — exercising the
    // floorApplies branch that none of the other tests touch.
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 2, ramMaxGB: 4, storageMaxGB: 40 }}
        pricingRates={{
          cpuPerHr: 0.011,
          ramPerGbHr: 0.003,
          diskPerGbHr: 0.0004,
          minChargePerHr: 1.0,
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Per Second" }))

    // Header is the floor / 3600, not the line sum / 3600.
    expect(screen.getByText("$0.00027778")).toBeInTheDocument()

    // Each breakdown row renders at per-second precision from the raw float.
    expect(screen.getByText("$0.00000611/s")).toBeInTheDocument()
    expect(screen.getByText("$0.00000333/s")).toBeInTheDocument()
    expect(screen.getByText("$0.00000444/s")).toBeInTheDocument()

    // MIN CHARGE row renders (floor - lineSum) / 3600 at 8-decimal precision.
    // Independent per-item rounding can cause the displayed rows to differ
    // from the header by ±1 ULP — acceptable at 8dp (~$0.004/year).
    expect(screen.getByText("MIN CHARGE")).toBeInTheDocument()
    expect(screen.getByText("$0.00026389/s")).toBeInTheDocument()
  })

  it("starts in hourly view by default as one page", async () => {
    render(
      <ProvisioningWizard
        variant="multistep"
        defaultConfig={{ cpuCores: 1, ramGB: 4, storageGB: 30, environment: "node", name: "", gitUrl: "", envVars: [], driver: "docker", bare: false }}
        skipToReview
      />,
    )

    // The hourly toggle is active by default; no stepper navigation is present.
    expect(screen.queryByText(/continue to/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Per Hour" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Per Second" })).toHaveAttribute("aria-pressed", "false")
  })

  it("returns to the hourly view when the user toggles back", async () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 4, ramMaxGB: 16, storageMaxGB: 128 }}
        pricingRates={{
          cpuPerHr: 0.045,
          ramPerGbHr: 0.005,
          diskPerGbHr: 0.0011,
          minChargePerHr: 0,
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Per Second" }))
    expect(screen.getByText("$0.00011133")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Per Hour" }))
    expect(screen.getByText("$0.40")).toBeInTheDocument()
    expect(screen.getByText("/ hour")).toBeInTheDocument()
  })
})

describe("ProvisioningWizard — planTiers", () => {
  it("badges locked presets with the smallest tier that unlocks them", () => {
    // Caller is on a Pro-equivalent plan. Performance (32 GB RAM) exceeds
    // Pro's 16 GB cap, so it must be locked AND badged with "Enterprise" —
    // not the legacy hardcoded "Pro" label.
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 8, ramMaxGB: 16, storageMaxGB: 256 }}
        planTiers={[
          { id: "free", label: "Free", cpuMax: 1, ramMaxGB: 2, storageMaxGB: 50 },
          { id: "pro", label: "Pro", cpuMax: 8, ramMaxGB: 16, storageMaxGB: 256 },
          { id: "enterprise", label: "Enterprise", cpuMax: 12, ramMaxGB: 32, storageMaxGB: 512 },
        ]}
      />,
    )

    // Performance row is the only locked preset under Pro limits.
    const performanceButton = screen.getByText("Performance").closest("button")
    expect(performanceButton).toBeDisabled()
    // The badge lives inside that button.
    expect(performanceButton?.textContent).toContain("Enterprise")
    // Other two are unlocked — no badge.
    expect(screen.getByText("Lightweight").closest("button")).not.toBeDisabled()
    expect(screen.getByText("Standard").closest("button")).not.toBeDisabled()
  })

  it("falls back to a 'Pro' badge when planTiers is not provided", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 50 }}
      />,
    )
    // Lightweight is locked on free-tier limits; without planTiers, the
    // wizard still has to render *some* label so it defaults to "Pro".
    const lightweightButton = screen.getByText("Lightweight").closest("button")
    expect(lightweightButton).toBeDisabled()
    expect(lightweightButton?.textContent).toContain("Pro")
  })

  it("renders no preset as selected when every row is locked", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 1, ramMaxGB: 2, storageMaxGB: 50 }}
      />,
    )
    for (const name of ["Lightweight", "Standard", "Performance"]) {
      const btn = screen.getByText(name).closest("button") as HTMLButtonElement
      expect(btn).toBeDisabled()
      // The "active" styling hinges on the `border-primary` class; none of
      // the locked rows should carry it (they use `border-border` instead).
      expect(btn.className).not.toContain("border-primary")
    }
  })
})

describe("ProvisioningWizard — add SSH key dialog", () => {
  it("hides the add-key action when onCreateKey is not provided", async () => {
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={{
          keys: [makeSshKey()],
          selectedKeyIds: [],
          inlinePublicKeys: "",
          onSelectedKeyIdsChange: vi.fn(),
          onInlinePublicKeysChange: vi.fn(),
        }}
      />,
    )

    await openAdvanced()
    expect(
      screen.queryByRole("button", { name: /add ssh key/i }),
    ).not.toBeInTheDocument()
  })

  it("renders the add-key action when onCreateKey is provided", async () => {
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({ onCreateKey: vi.fn() })}
      />,
    )

    await openAdvanced()
    expect(
      screen.getByRole("button", { name: /add ssh key/i }),
    ).toBeInTheDocument()
  })

  it("opens the dialog with Name and Public key fields", async () => {
    const user = userEvent.setup()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({ onCreateKey: vi.fn() })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Name")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Public key")).toBeInTheDocument()
  })

  it("shows inline validation errors and does not call create on empty submit", async () => {
    const user = userEvent.setup()
    const onCreateKey = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({ onCreateKey })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    expect(within(dialog).getByText("Name is required")).toBeInTheDocument()
    expect(within(dialog).getByText("Public key is required")).toBeInTheDocument()
    expect(onCreateKey).not.toHaveBeenCalled()
  })

  it("rejects a malformed public key with an inline error", async () => {
    const user = userEvent.setup()
    const onCreateKey = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({ onCreateKey })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "My key")
    await user.type(within(dialog).getByLabelText("Public key"), "not-a-key")
    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    expect(
      within(dialog).getByText(/enter a valid public key/i),
    ).toBeInTheDocument()
    expect(onCreateKey).not.toHaveBeenCalled()
  })

  it("on success calls create + refresh, closes, clears, and selects the new key id", async () => {
    const user = userEvent.setup()
    const created = makeSshKey({ id: "new-1", name: "New" })
    const onCreateKey = vi.fn().mockResolvedValue(created)
    const onRefreshKeys = vi.fn().mockResolvedValue([created])
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({
          onCreateKey,
          onRefreshKeys,
          onSelectedKeyIdsChange,
        })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "New")
    await user.type(within(dialog).getByLabelText("Public key"), VALID_PUBLIC_KEY)
    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    await waitFor(() => {
      expect(onCreateKey).toHaveBeenCalledWith({
        name: "New",
        publicKey: VALID_PUBLIC_KEY,
      })
    })
    expect(onRefreshKeys).toHaveBeenCalledOnce()
    // New key selected by id; selection cleared of duplicates.
    expect(onSelectedKeyIdsChange).toHaveBeenCalledWith(["new-1"])
    // Dialog closed.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("does not call onRefreshKeys when it is not provided", async () => {
    const user = userEvent.setup()
    const created = makeSshKey({ id: "new-1", name: "New" })
    const onCreateKey = vi.fn().mockResolvedValue(created)
    const onRefreshKeys = undefined
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({
          onCreateKey,
          onRefreshKeys,
          onSelectedKeyIdsChange,
        })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "New")
    await user.type(within(dialog).getByLabelText("Public key"), VALID_PUBLIC_KEY)
    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    await waitFor(() => {
      expect(onCreateKey).toHaveBeenCalledOnce()
    })
    expect(onSelectedKeyIdsChange).toHaveBeenCalledWith(["new-1"])
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("does not auto-select when onCreateKey returns no key", async () => {
    const user = userEvent.setup()
    const onCreateKey = vi.fn().mockResolvedValue(undefined)
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({
          onCreateKey,
          onSelectedKeyIdsChange,
        })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "New")
    await user.type(within(dialog).getByLabelText("Public key"), VALID_PUBLIC_KEY)
    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    await waitFor(() => {
      expect(onCreateKey).toHaveBeenCalledOnce()
    })
    expect(onSelectedKeyIdsChange).not.toHaveBeenCalled()
  })

  it("on failure shows an inline error, keeps the dialog open and values intact", async () => {
    const user = userEvent.setup()
    const onCreateKey = vi.fn().mockRejectedValue(new Error("Key already exists"))
    const onSelectedKeyIdsChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({
          onCreateKey,
          onSelectedKeyIdsChange,
        })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "Dup")
    await user.type(within(dialog).getByLabelText("Public key"), VALID_PUBLIC_KEY)
    await user.click(within(dialog).getByRole("button", { name: /add key/i }))

    await waitFor(() => {
      expect(within(dialog).getByText("Key already exists")).toBeInTheDocument()
    })
    // Dialog still present and draft preserved.
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Dup")
    expect(within(dialog).getByLabelText("Public key")).toHaveValue(VALID_PUBLIC_KEY)
    // No selection change on failure.
    expect(onSelectedKeyIdsChange).not.toHaveBeenCalled()
  })

  it("cancel closes the dialog without changing selected keys or inline public keys", async () => {
    const user = userEvent.setup()
    const onSelectedKeyIdsChange = vi.fn()
    const onInlinePublicKeysChange = vi.fn()
    render(
      <ProvisioningWizard
        variant="flat"
        sshAccess={makeSshAccess({
          onCreateKey: vi.fn(),
          selectedKeyIds: ["k1"],
          inlinePublicKeys: VALID_PUBLIC_KEY,
          onSelectedKeyIdsChange,
          onInlinePublicKeysChange,
        })}
      />,
    )

    await openAdvanced()
    await user.click(screen.getByRole("button", { name: /add ssh key/i }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Name"), "Draft")
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(onSelectedKeyIdsChange).not.toHaveBeenCalled()
    expect(onInlinePublicKeysChange).not.toHaveBeenCalled()
  })
})

describe("ProvisioningWizard — resourceLimits above the default ceiling", () => {
  it("lets a plan exceed the hardcoded fallback ceilings (e.g. 12 vCPU)", () => {
    // Enterprise-class limits sit above the built-in CPU_MAX(8)/RAM_MAX(32)/
    // STORAGE_MAX(512) fallbacks. The plan must be authoritative — the
    // sliders have to reach the plan's real maxima, not the fallbacks.
    render(
      <ProvisioningWizard
        resourceLimits={{ cpuMax: 12, ramMaxGB: 64, storageMaxGB: 1024 }}
      />,
    )

    const sliders = screen.getAllByRole("slider")
    expect(sliders[0]).toHaveAttribute("max", "12")
    expect(sliders[1]).toHaveAttribute("max", "64")
    expect(sliders[2]).toHaveAttribute("max", "1024")
  })
})

describe("ProvisioningWizard — environment section visibility", () => {
  it("hides the environment section when only one option exists", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ProvisioningWizard
        onSubmit={onSubmit}
        environments={[
          {
            id: "universal",
            name: "Default",
            description: "The only option",
            icon: null,
            color: "violet",
          },
        ]}
      />,
    )

    // The picker is a no-op with a single option, so it's omitted entirely…
    expect(screen.queryByText("Environment Selection")).not.toBeInTheDocument()

    // …but the lone option is still used implicitly on deploy.
    await userEvent.click(
      screen.getByRole("button", { name: /deploy workspace/i }),
    )
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    expect(onSubmit.mock.calls[0][0].environment).toBe("universal")
  })

  it("shows the environment section when more than one option exists", () => {
    render(
      <ProvisioningWizard
        environments={[
          { id: "universal", name: "Default", description: "", icon: null, color: "violet" },
          { id: "template:abc", name: "My Template", description: "", icon: null, color: "green" },
        ]}
      />,
    )

    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(screen.getByText("My Template")).toBeInTheDocument()
  })

  it("shows the section with an empty-state (not a silent dead-end) when no options load", () => {
    render(<ProvisioningWizard environments={[]} />)

    // With zero options the section must stay visible and explain the empty
    // state, rather than vanishing and leaving deploy disabled with no context.
    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(
      screen.getByText(/no environments are available/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /deploy workspace/i }),
    ).toBeDisabled()
  })

  it("keeps the section visible with skeletons while environments load", () => {
    // A never-resolving loader holds the wizard in its loading state. The
    // section must stay visible and show skeleton placeholders (not the
    // empty-state, and not a hidden section).
    const { container } = render(
      <ProvisioningWizard
        onLoadEnvironments={() => new Promise<EnvironmentEntry[]>(() => {})}
      />,
    )

    expect(screen.getByText("Environment Selection")).toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
    expect(
      screen.queryByText(/no environments are available/i),
    ).not.toBeInTheDocument()
  })
})

describe("ProvisioningWizard — driver selection", () => {
  it("submits the controlled driver chosen via the Select primitive", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ProvisioningWizard
        onSubmit={onSubmit}
        defaultConfig={{ driver: "firecracker" }}
      />,
    )

    await userEvent.click(
      screen.getByRole("button", { name: /deploy workspace/i }),
    )
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    expect(onSubmit.mock.calls[0][0].driver).toBe("firecracker")
  })

  it("changes the driver through the Select UI and submits the chosen value", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ProvisioningWizard onSubmit={onSubmit} />)

    await openAdvanced()
    // Default is Docker; drive the custom Select trigger + option to switch.
    await userEvent.click(screen.getByRole("combobox"))
    await userEvent.click(
      await screen.findByRole("option", { name: /firecracker/i }),
    )

    await userEvent.click(
      screen.getByRole("button", { name: /deploy workspace/i }),
    )
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    expect(onSubmit.mock.calls[0][0].driver).toBe("firecracker")
  })
})

describe("ProvisioningWizard — environment variable value reveal", () => {
  it("masks the value by default and reveals it on toggle", async () => {
    render(<ProvisioningWizard />)

    await openAdvanced()
    const valueInput = screen.getByPlaceholderText("sk-xxxxxxxxxxx")
    expect(valueInput).toHaveAttribute("type", "password")

    await userEvent.click(screen.getByRole("button", { name: /show value/i }))
    expect(valueInput).toHaveAttribute("type", "text")

    await userEvent.click(screen.getByRole("button", { name: /hide value/i }))
    expect(valueInput).toHaveAttribute("type", "password")
  })

  it("keeps each row's reveal state bound to its own value after a row is deleted", async () => {
    render(<ProvisioningWizard />)
    await openAdvanced()

    // Three rows so we can reveal the middle one and delete the row above it.
    await userEvent.click(screen.getByRole("button", { name: /add var/i }))
    await userEvent.click(screen.getByRole("button", { name: /add var/i }))

    const keyInputs = screen.getAllByPlaceholderText("API_KEY")
    const valueInputs = screen.getAllByPlaceholderText("sk-xxxxxxxxxxx")
    expect(valueInputs).toHaveLength(3)
    await userEvent.type(keyInputs[0], "FIRST")
    await userEvent.type(valueInputs[0], "first-secret")
    await userEvent.type(keyInputs[1], "SECOND")
    await userEvent.type(valueInputs[1], "second-secret")
    await userEvent.type(keyInputs[2], "THIRD")
    await userEvent.type(valueInputs[2], "third-secret")

    // Reveal ONLY the second row.
    await userEvent.click(
      screen.getAllByRole("button", { name: /show value/i })[1],
    )
    expect(valueInputs[1]).toHaveAttribute("type", "text")

    // Delete the FIRST row.
    await userEvent.click(
      screen.getAllByRole("button", { name: /remove variable/i })[0],
    )

    // The previously-revealed value stays revealed; the never-revealed value
    // must remain masked. With index keys the reveal state would migrate onto
    // the third row's secret here.
    const remaining = screen.getAllByPlaceholderText(
      "sk-xxxxxxxxxxx",
    ) as HTMLInputElement[]
    expect(remaining).toHaveLength(2)
    const second = remaining.find((el) => el.value === "second-secret")
    const third = remaining.find((el) => el.value === "third-secret")
    expect(second).toHaveAttribute("type", "text")
    expect(third).toHaveAttribute("type", "password")
  })
})

describe("ProvisioningWizard — async single-environment selection", () => {
  it("submits the sole async-loaded environment even though the picker is hidden", async () => {
    // Reproduces the exact async pattern of the real consumer: environments
    // arrive after mount (so environments[0] is undefined on the first
    // render) and there's a single option, so the picker is hidden. The
    // post-load sync effect must still land selectedEnv on that option, and
    // deploy must submit it — not an empty string.
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onLoadEnvironments = vi
      .fn()
      .mockResolvedValue([{ id: "universal", description: "Default" }])

    render(
      <ProvisioningWizard
        onSubmit={onSubmit}
        onLoadEnvironments={onLoadEnvironments}
      />,
    )

    // Single option → the picker is omitted once loading resolves.
    await waitFor(() => {
      expect(
        screen.queryByText("Environment Selection"),
      ).not.toBeInTheDocument()
    })

    const deployBtn = screen.getByRole("button", {
      name: /deploy workspace/i,
    })
    // Deploy is gated on a non-empty selection, so it only enables once the
    // sole option has been adopted.
    await waitFor(() => expect(deployBtn).toBeEnabled())
    await userEvent.click(deployBtn)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    expect(onSubmit.mock.calls[0][0].environment).toBe("universal")
  })

  it("falls back to the sole loaded option when the requested default is stale", async () => {
    // A caller passes a default that no longer exists (e.g. a deleted
    // template) while the loaded list contains a single valid option. The
    // picker is hidden, so the sync effect must drop the invalid default and
    // submit the real option rather than the stale id.
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onLoadEnvironments = vi
      .fn()
      .mockResolvedValue([{ id: "universal", description: "Default" }])

    render(
      <ProvisioningWizard
        onSubmit={onSubmit}
        onLoadEnvironments={onLoadEnvironments}
        defaultEnvironment="deleted-template"
      />,
    )

    await waitFor(() => {
      expect(
        screen.queryByText("Environment Selection"),
      ).not.toBeInTheDocument()
    })

    const deployBtn = screen.getByRole("button", {
      name: /deploy workspace/i,
    })
    await waitFor(() => expect(deployBtn).toBeEnabled())
    await userEvent.click(deployBtn)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    expect(onSubmit.mock.calls[0][0].environment).toBe("universal")
  })
})
