import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ProvisioningWizard,
  resolveEnvironment,
  formatPerSecondValue,
  type ProvisioningConfig,
  type StartupScriptEntry,
  type EnvironmentEntry,
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

describe("ProvisioningWizard — startup scripts integration", () => {
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
      <ProvisioningWizard onSubmit={onSubmit} variant="flat" />,
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

  it("'Start from scratch' clamps values to resourceLimits", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        variant="multistep"
        onSubmit={onSubmit}
        defaultConfig={{ cpuCores: 1, ramGB: 4, storageGB: 30, environment: "node", modelTier: "claude-sonnet", systemPrompt: "", name: "", gitUrl: "", envVars: [], driver: "docker", bare: false }}
        skipToReview
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // Click "Start from scratch"
    await user.click(screen.getByText("Start from scratch"))

    // Navigate to step 3 so deploy is available
    await user.click(screen.getByText(/continue to/i))
    await user.click(screen.getByText(/continue to/i))

    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

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

describe("ProvisioningWizard — modelOptions", () => {
  it("renders the provided model options in the dropdown", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        modelOptions={[
          { value: "claude-sonnet", label: "Claude Sonnet 4.5" },
          { value: "gpt-5.2", label: "GPT-5.2" },
        ]}
      />,
    )
    expect(screen.getByRole("option", { name: "Claude Sonnet 4.5" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "GPT-5.2" })).toBeInTheDocument()
    // The default "Mistral"/"Llama" strings must not bleed through
    expect(screen.queryByText(/Llama/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mistral/i)).not.toBeInTheDocument()
  })

  it("auto-selects the first available option when the current value is not in the list", async () => {
    // The wizard's internal `modelTier` state starts at "claude-sonnet".
    // If the caller's option list only contains other ids, the wizard
    // must switch to the first available option so the <select>
    // reflects a real value instead of silently dropping to an unknown.
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ProvisioningWizard
        variant="flat"
        onSubmit={onSubmit}
        modelOptions={[
          { value: "gpt-5.2", label: "GPT-5.2" },
          { value: "glm-4.7", label: "GLM 4.7" },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /deploy workspace/i }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.modelTier).toBe("gpt-5.2")
  })

  it("skips past disabled options when auto-selecting", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ProvisioningWizard
        variant="flat"
        onSubmit={onSubmit}
        modelOptions={[
          { value: "gpt-5.2", label: "GPT-5.2", disabled: true },
          { value: "glm-4.7", label: "GLM 4.7" },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /deploy workspace/i }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.modelTier).toBe("glm-4.7")
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

describe("formatPerSecondValue", () => {
  it("formats zero with a stable 8-decimal width", () => {
    expect(formatPerSecondValue(0)).toBe("0.00000000")
  })

  it("converts an exact hourly value to per-second seconds-of-an-hour", () => {
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

    // MIN CHARGE row renders `floor - lineSum` per-second so that, modulo
    // sub-rounding drift, line items + MIN CHARGE reconcile to the header.
    // If a future refactor renders `floor` instead of `floor - lineSum`
    // here, this assertion catches the silent invariant break.
    expect(screen.getByText("MIN CHARGE")).toBeInTheDocument()
    expect(screen.getByText("$0.00026389/s")).toBeInTheDocument()
  })

  it("'Start from scratch' resets the pricing view to hourly", async () => {
    const user = userEvent.setup()

    render(
      <ProvisioningWizard
        variant="multistep"
        defaultConfig={{ cpuCores: 1, ramGB: 4, storageGB: 30, environment: "node", modelTier: "claude-sonnet", systemPrompt: "", name: "", gitUrl: "", envVars: [], driver: "docker", bare: false }}
        skipToReview
      />,
    )

    // Switch to per-second view, then start over.
    await user.click(screen.getByRole("button", { name: "Per Second" }))
    expect(screen.getByRole("button", { name: "Per Second" })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByText("Start from scratch"))

    // The hourly toggle should be active again.
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
