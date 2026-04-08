import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ProvisioningWizard,
  type ProvisioningConfig,
  type StartupScriptEntry,
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
