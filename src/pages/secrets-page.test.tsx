import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SecretsPage, type SecretsApiClient, type Secret } from "./secrets-page"

function makeSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    name: "API_KEY",
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  }
}

function makeApiClient(overrides: Partial<SecretsApiClient> = {}): SecretsApiClient {
  return {
    listSecrets: vi.fn().mockResolvedValue([]),
    createSecret: vi.fn().mockResolvedValue(undefined),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("SecretsPage", () => {
  let api: ReturnType<typeof makeApiClient>

  beforeEach(() => {
    api = makeApiClient()
  })

  it("renders the page header", async () => {
    render(<SecretsPage apiClient={api} />)
    expect(screen.getByText("Environment Secrets")).toBeInTheDocument()
    expect(screen.getByText(/Secrets are securely stored/)).toBeInTheDocument()
  })

  it("shows empty state when no secrets exist", async () => {
    render(<SecretsPage apiClient={api} />)
    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument()
    })
  })

  it("renders secrets table after loading", async () => {
    const secrets = [
      makeSecret({ name: "DB_PASSWORD", createdAt: "2026-02-01T00:00:00Z" }),
      makeSecret({ name: "GITHUB_TOKEN", createdAt: "2026-03-01T00:00:00Z" }),
    ]
    api.listSecrets = vi.fn().mockResolvedValue(secrets)
    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("DB_PASSWORD")).toBeInTheDocument()
    })
    expect(screen.getByText("GITHUB_TOKEN")).toBeInTheDocument()
  })

  it("displays correct total count in stats", async () => {
    const secrets = [
      makeSecret({ name: "KEY_A" }),
      makeSecret({ name: "KEY_B" }),
      makeSecret({ name: "KEY_C" }),
    ]
    api.listSecrets = vi.fn().mockResolvedValue(secrets)
    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument()
    })
  })

  it("shows error banner when loading fails", async () => {
    api.listSecrets = vi.fn().mockRejectedValue(new Error("Connection refused"))
    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeInTheDocument()
    })
  })

  it("opens create dialog and creates a secret", async () => {
    const user = userEvent.setup()
    api.createSecret = vi.fn().mockResolvedValue(undefined)
    api.listSecrets = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeSecret({ name: "NEW_SECRET" })])

    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument()
    })

    // Click the header "Add Secret" button
    await user.click(screen.getByRole("button", { name: /add secret/i }))

    // Scope to dialog
    const dialog = await screen.findByRole("dialog")

    const nameInput = within(dialog).getByPlaceholderText("MY_SECRET_KEY")
    await user.type(nameInput, "NEW_SECRET")

    const valueInput = within(dialog).getByPlaceholderText("Enter secret value...")
    await user.type(valueInput, "super-secret-value")

    // Click the submit button inside the dialog
    const submitBtn = within(dialog).getByRole("button", { name: /create secret/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(api.createSecret).toHaveBeenCalledWith("NEW_SECRET", "super-secret-value")
    })
  })

  it("disables create button when name or value is empty", async () => {
    const user = userEvent.setup()
    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /add secret/i }))

    const dialog = await screen.findByRole("dialog")
    const submitBtn = within(dialog).getByRole("button", { name: /create secret/i })
    expect(submitBtn).toBeDisabled()
  })

  it("shows create error when creation fails", async () => {
    const user = userEvent.setup()
    api.createSecret = vi.fn().mockRejectedValue(new Error("Name already exists"))

    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /add secret/i }))

    const dialog = await screen.findByRole("dialog")

    const nameInput = within(dialog).getByPlaceholderText("MY_SECRET_KEY")
    await user.type(nameInput, "DUPE")

    const valueInput = within(dialog).getByPlaceholderText("Enter secret value...")
    await user.type(valueInput, "val")

    const submitBtn = within(dialog).getByRole("button", { name: /create secret/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText("Name already exists")).toBeInTheDocument()
    })
  })

  it("opens delete confirmation and deletes a secret", async () => {
    const user = userEvent.setup()
    const secrets = [makeSecret({ name: "TO_DELETE" })]
    api.listSecrets = vi.fn()
      .mockResolvedValueOnce(secrets)
      .mockResolvedValueOnce([])
    api.deleteSecret = vi.fn().mockResolvedValue(undefined)

    render(<SecretsPage apiClient={api} />)

    await waitFor(() => {
      expect(screen.getByText("TO_DELETE")).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText("Delete TO_DELETE"))

    await waitFor(() => {
      expect(screen.getByText("Delete Secret?")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /^Delete Secret$/ }))

    await waitFor(() => {
      expect(api.deleteSecret).toHaveBeenCalledWith("TO_DELETE")
    })
  })

  it("applies className prop", () => {
    const { container } = render(
      <SecretsPage apiClient={api} className="test-class" />,
    )
    expect(container.firstElementChild).toHaveClass("test-class")
  })
})
