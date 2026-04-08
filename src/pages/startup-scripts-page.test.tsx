import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  StartupScriptsPage,
  type StartupScriptsApiClient,
  type StartupScript,
} from "./startup-scripts-page"

function makeScript(overrides: Partial<StartupScript> = {}): StartupScript {
  return {
    id: "script-1",
    name: "Install Claude Code",
    description: "Install and configure Claude Code CLI",
    scriptType: "bash",
    content: "#!/bin/bash\nnpm install -g @anthropic-ai/claude-code",
    environments: [],
    minCpuCores: null,
    minRamGB: null,
    runOrder: 100,
    timeoutSeconds: 300,
    continueOnFailure: false,
    runAsRoot: false,
    injectSecrets: [],
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeApiClient(overrides: Partial<StartupScriptsApiClient> = {}): StartupScriptsApiClient {
  return {
    listScripts: vi.fn().mockResolvedValue([]),
    createScript: vi.fn().mockResolvedValue(makeScript()),
    updateScript: vi.fn().mockResolvedValue(makeScript()),
    deleteScript: vi.fn().mockResolvedValue(undefined),
    toggleScript: vi.fn().mockResolvedValue(makeScript({ enabled: false })),
    listSecrets: vi.fn().mockResolvedValue([]),
    listEnvironments: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe("StartupScriptsPage", () => {
  let api: ReturnType<typeof makeApiClient>

  beforeEach(() => {
    api = makeApiClient()
  })

  it("renders the page header", async () => {
    render(<StartupScriptsPage apiClient={api} />)
    expect(screen.getByText("Startup Scripts")).toBeInTheDocument()
    expect(screen.getByText(/Define scripts that run automatically/)).toBeInTheDocument()
  })

  it("shows loading spinner initially", () => {
    // Make listScripts never resolve to keep loading state
    api.listScripts = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<StartupScriptsPage apiClient={api} />)
    expect(api.listScripts).toHaveBeenCalledOnce()
  })

  it("shows empty state when no scripts exist", async () => {
    render(<StartupScriptsPage apiClient={api} />)
    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })
    expect(screen.getByText(/Create a script to run automatically/)).toBeInTheDocument()
  })

  it("renders scripts list after loading", async () => {
    const scripts = [
      makeScript({ id: "1", name: "Script A", description: "First script" }),
      makeScript({ id: "2", name: "Script B", description: "Second script", enabled: false }),
    ]
    api.listScripts = vi.fn().mockResolvedValue(scripts)
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Script A")).toBeInTheDocument()
    })
    expect(screen.getByText("Script B")).toBeInTheDocument()
    expect(screen.getByText("First script")).toBeInTheDocument()
    expect(screen.getByText("Second script")).toBeInTheDocument()
  })

  it("displays correct stats", async () => {
    const scripts = [
      makeScript({ id: "1", name: "Active", enabled: true }),
      makeScript({ id: "2", name: "Disabled", enabled: false }),
      makeScript({ id: "3", name: "Also Active", enabled: true }),
    ]
    api.listScripts = vi.fn().mockResolvedValue(scripts)
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument() // total
    })
    expect(screen.getByText("2")).toBeInTheDocument() // active count
  })

  it("shows error banner when loading fails", async () => {
    api.listScripts = vi.fn().mockRejectedValue(new Error("Network error"))
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })

  it("opens create dialog with picker step", async () => {
    const user = userEvent.setup()
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })

    // Click the "New Script" button in the header
    await user.click(screen.getByRole("button", { name: /new script/i }))

    await waitFor(() => {
      expect(screen.getByText("New Startup Script")).toBeInTheDocument()
    })
    expect(screen.getByText("Blank Script")).toBeInTheDocument()
    expect(screen.getByText("Templates")).toBeInTheDocument()
  })

  it("navigates from picker to blank script form", async () => {
    const user = userEvent.setup()
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /new script/i }))

    await waitFor(() => {
      expect(screen.getByText("Blank Script")).toBeInTheDocument()
    })

    // Click "Bash" blank script type
    await user.click(screen.getByRole("button", { name: "Bash" }))

    await waitFor(() => {
      expect(screen.getByText("Create Startup Script")).toBeInTheDocument()
    })
  })

  it("creates a script via the form", async () => {
    const user = userEvent.setup()
    api.createScript = vi.fn().mockResolvedValue(makeScript({ name: "My Script" }))
    // After creation, listScripts reloads
    api.listScripts = vi.fn()
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([makeScript({ name: "My Script" })]) // after creation

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /new script/i }))
    await waitFor(() => {
      expect(screen.getByText("Blank Script")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Bash" }))
    await waitFor(() => {
      expect(screen.getByText("Create Startup Script")).toBeInTheDocument()
    })

    // Fill in the name
    const nameInput = screen.getByPlaceholderText("Install Claude Code")
    await user.type(nameInput, "My Script")

    // Submit
    await user.click(screen.getByRole("button", { name: /create script/i }))

    await waitFor(() => {
      expect(api.createScript).toHaveBeenCalledOnce()
    })
    expect(api.createScript).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Script" }),
    )
  })

  it("disables create button when name is empty", async () => {
    const user = userEvent.setup()
    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /new script/i }))
    await waitFor(() => {
      expect(screen.getByText("Blank Script")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Bash" }))
    await waitFor(() => {
      expect(screen.getByText("Create Startup Script")).toBeInTheDocument()
    })

    // The create button should be disabled because name is empty
    const createBtn = screen.getByRole("button", { name: /create script/i })
    expect(createBtn).toBeDisabled()
  })

  it("toggles a script's enabled state", async () => {
    const user = userEvent.setup()
    const script = makeScript({ id: "1", name: "Toggle Me", enabled: true })
    api.listScripts = vi.fn().mockResolvedValue([script])
    api.toggleScript = vi.fn().mockResolvedValue({ ...script, enabled: false })

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Toggle Me")).toBeInTheDocument()
    })

    // The toggle button is the status indicator (Power icon button)
    const toggleBtn = screen.getByTitle("Disable")
    await user.click(toggleBtn)

    await waitFor(() => {
      expect(api.toggleScript).toHaveBeenCalledWith("1")
    })
  })

  it("shows delete confirmation dialog and deletes script", async () => {
    const user = userEvent.setup()
    const script = makeScript({ id: "del-1", name: "Delete Me" })
    api.listScripts = vi.fn()
      .mockResolvedValueOnce([script])
      .mockResolvedValueOnce([]) // after delete
    api.deleteScript = vi.fn().mockResolvedValue(undefined)

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Delete Me")).toBeInTheDocument()
    })

    // Click the delete button (trash icon)
    const deleteBtn = screen.getByTitle("Delete")
    await user.click(deleteBtn)

    // Confirm the deletion dialog appears
    await waitFor(() => {
      expect(screen.getByText("Delete Startup Script")).toBeInTheDocument()
    })
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()

    // Click the Delete button in the dialog
    await user.click(screen.getByRole("button", { name: /^Delete$/ }))

    await waitFor(() => {
      expect(api.deleteScript).toHaveBeenCalledWith("del-1")
    })
  })

  it("shows form error when save fails", async () => {
    const user = userEvent.setup()
    api.createScript = vi.fn().mockRejectedValue(new Error("Validation failed"))

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No startup scripts yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /new script/i }))
    await waitFor(() => {
      expect(screen.getByText("Blank Script")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Bash" }))
    await waitFor(() => {
      expect(screen.getByText("Create Startup Script")).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText("Install Claude Code")
    await user.type(nameInput, "Broken Script")

    await user.click(screen.getByRole("button", { name: /create script/i }))

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument()
    })
  })

  it("displays script badges (secrets, environments, flags)", async () => {
    const script = makeScript({
      id: "1",
      name: "Complex Script",
      injectSecrets: ["GITHUB_TOKEN"],
      environments: ["node"],
      continueOnFailure: true,
      runAsRoot: true,
    })
    api.listScripts = vi.fn().mockResolvedValue([script])

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Complex Script")).toBeInTheDocument()
    })
    expect(screen.getByText("GITHUB_TOKEN")).toBeInTheDocument()
    expect(screen.getByText("node")).toBeInTheDocument()
    expect(screen.getByText("soft fail")).toBeInTheDocument()
    expect(screen.getByText("root")).toBeInTheDocument()
  })

  it("opens edit dialog when clicking edit button", async () => {
    const user = userEvent.setup()
    const script = makeScript({ id: "1", name: "Edit Me", description: "A script to edit" })
    api.listScripts = vi.fn().mockResolvedValue([script])

    render(<StartupScriptsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Edit Me")).toBeInTheDocument()
    })

    await user.click(screen.getByTitle("Edit"))

    await waitFor(() => {
      expect(screen.getByText("Edit Script")).toBeInTheDocument()
    })
    // The form should be pre-filled
    const nameInput = screen.getByDisplayValue("Edit Me")
    expect(nameInput).toBeInTheDocument()
  })

  it("applies className prop", () => {
    const { container } = render(
      <StartupScriptsPage apiClient={api} className="test-class" />,
    )
    expect(container.firstElementChild).toHaveClass("test-class")
  })
})
