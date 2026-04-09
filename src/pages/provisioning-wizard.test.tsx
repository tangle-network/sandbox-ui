import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ProvisioningWizard,
  resolveEnvironment,
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

  it("preset buttons clamp values to resourceLimits", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ProvisioningWizard
        variant="flat"
        onSubmit={onSubmit}
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // Click "Performance" preset (8C/32G/256G) which exceeds all limits
    await user.click(screen.getByText("Performance"))

    await user.click(screen.getByRole("button", { name: /deploy workspace/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const config: ProvisioningConfig = onSubmit.mock.calls[0][0]
    expect(config.cpuCores).toBe(2)
    expect(config.ramGB).toBe(8)
    expect(config.storageGB).toBe(64)
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

  it("preset labels reflect clamped values when limits are active", () => {
    render(
      <ProvisioningWizard
        variant="flat"
        resourceLimits={{ cpuMax: 2, ramMaxGB: 8, storageMaxGB: 64 }}
      />,
    )

    // Both "Standard" (4/16/128) and "Performance" (8/32/256) clamp to the same values
    const clampedLabels = screen.getAllByText("2C / 8G / 64G")
    expect(clampedLabels).toHaveLength(2)
    // "Lightweight" preset (2C/4G/50G) — cpu and ram within limits, storage within limits
    expect(screen.getByText("2C / 4G / 50G")).toBeInTheDocument()
  })
})
