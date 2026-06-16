import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
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
    await user.click(screen.getByRole("button", { name: /new secret/i }))

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

    await user.click(screen.getByRole("button", { name: /new secret/i }))

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

    await user.click(screen.getByRole("button", { name: /new secret/i }))

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

  // --- teamSecretsHint banner tests ---

  describe("teamSecretsHint", () => {
    it("renders the team-secrets hint banner when prop is provided", async () => {
      const onNavigate = vi.fn()
      render(<SecretsPage apiClient={api} teamSecretsHint={{ onNavigate }} />)

      expect(screen.getByText("Setting up secrets for a team?")).toBeInTheDocument()
      expect(screen.getByText(/Secrets here are/)).toBeInTheDocument()
    })

    it("does not render the team-secrets hint banner when prop is omitted", async () => {
      render(<SecretsPage apiClient={api} />)

      expect(screen.queryByText("Setting up secrets for a team?")).not.toBeInTheDocument()
    })

    it("uses default CTA label when no custom label is provided", async () => {
      const onNavigate = vi.fn()
      render(<SecretsPage apiClient={api} teamSecretsHint={{ onNavigate }} />)

      expect(screen.getByRole("button", { name: /manage team secrets/i })).toBeInTheDocument()
    })

    it("uses custom CTA label when provided", async () => {
      const onNavigate = vi.fn()
      render(
        <SecretsPage
          apiClient={api}
          teamSecretsHint={{ onNavigate, label: "Go to Teams" }}
        />,
      )

      expect(screen.getByRole("button", { name: /go to teams/i })).toBeInTheDocument()
    })

    it("calls onNavigate when the CTA button is clicked", async () => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()
      render(<SecretsPage apiClient={api} teamSecretsHint={{ onNavigate }} />)

      await user.click(screen.getByRole("button", { name: /manage team secrets/i }))

      expect(onNavigate).toHaveBeenCalledTimes(1)
    })
  })

  // --- Bulk .env import tests ---

  describe("Import .env", () => {
    async function openImportDialog() {
      const user = userEvent.setup()
      render(<SecretsPage apiClient={api} />)
      await waitFor(() => {
        expect(screen.getByText("No secrets yet")).toBeInTheDocument()
      })
      await user.click(screen.getByRole("button", { name: /import \.env/i }))
      const dialog = await screen.findByRole("dialog")
      return { user, dialog }
    }

    it("renders the Import .env button and opens the modal", async () => {
      const { dialog } = await openImportDialog()
      expect(within(dialog).getByText("Import Secrets")).toBeInTheDocument()
      expect(within(dialog).getByLabelText("Paste .env contents")).toBeInTheDocument()
    })

    it("parses pasted content into editable rows", async () => {
      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "API_KEY=secret-value\nDB_PASS=hunter2")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))

      expect(await within(dialog).findByLabelText("Import row 1 key")).toHaveValue("API_KEY")
      expect(within(dialog).getByLabelText("Import row 1 value")).toHaveValue("secret-value")
      expect(within(dialog).getByLabelText("Import row 2 key")).toHaveValue("DB_PASS")
      // values are masked by default
      expect(within(dialog).getByLabelText("Import row 2 value")).toHaveAttribute("type", "password")
    })

    it("parses an uploaded file into rows", async () => {
      const { dialog } = await openImportDialog()

      const file = new File(["API_KEY=fromfile\nTOKEN=abc"], "secrets.env", { type: "text/plain" })
      const input = within(dialog).getByLabelText("Upload .env file") as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      expect(await within(dialog).findByLabelText("Import row 1 key")).toHaveValue("API_KEY")
      expect(within(dialog).getByLabelText("Import row 1 value")).toHaveValue("fromfile")
      expect(within(dialog).getByLabelText("Import row 2 key")).toHaveValue("TOKEN")
    })

    it("shows parse errors and blocks save when content is invalid", async () => {
      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "BROKEN_NO_EQUALS\nGOOD=1")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))

      expect(await within(dialog).findByText(/could not be parsed/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/Missing '=' separator/i)).toBeInTheDocument()

      const saveBtn = within(dialog).getByRole("button", { name: /import \d+ secret/i })
      expect(saveBtn).toBeDisabled()
      expect(api.createSecret).not.toHaveBeenCalled()
    })

    it("allows editing a row key/value and removing a row before save", async () => {
      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "first=1\nsecond=2")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))

      const keyInput = await within(dialog).findByLabelText("Import row 1 key")
      await user.clear(keyInput)
      await user.type(keyInput, "renamed-lower")
      expect(keyInput).toHaveValue("RENAMED_LOWER")

      const valueInput = within(dialog).getByLabelText("Import row 1 value")
      await user.clear(valueInput)
      await user.type(valueInput, "edited")
      expect(valueInput).toHaveValue("edited")

      // remove the second row
      await user.click(within(dialog).getByLabelText("Remove import row 2"))
      expect(within(dialog).queryByLabelText("Import row 2 key")).not.toBeInTheDocument()
      expect(within(dialog).getByLabelText("Import row 1 key")).toBeInTheDocument()
    })

    it("saves all rows, refreshes the list, and closes the modal", async () => {
      api.createSecret = vi.fn().mockResolvedValue(undefined)
      api.listSecrets = vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeSecret({ name: "API_KEY" }),
          makeSecret({ name: "DB_PASS" }),
        ])

      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "API_KEY=aaa\nDB_PASS=bbb")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))

      const saveBtn = await within(dialog).findByRole("button", { name: /import 2 secrets/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(api.createSecret).toHaveBeenCalledWith("API_KEY", "aaa")
        expect(api.createSecret).toHaveBeenCalledWith("DB_PASS", "bbb")
      })
      // refreshed once after the bulk save
      await waitFor(() => {
        expect(api.listSecrets).toHaveBeenCalledTimes(2)
      })
      // modal closed and values cleared from the DOM
      await waitFor(() => {
        expect(screen.queryByText("Import Secrets")).not.toBeInTheDocument()
      })
      expect(screen.queryByLabelText("Import row 1 value")).not.toBeInTheDocument()
    })

    it("shows per-row failures on partial failure and keeps the modal open", async () => {
      api.createSecret = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Name already exists"))
      api.listSecrets = vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeSecret({ name: "OK_ONE" })])

      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "OK_ONE=1\nBAD_TWO=2")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))

      const saveBtn = await within(dialog).findByRole("button", { name: /import 2 secrets/i })
      await user.click(saveBtn)

      // success marker + failure message both visible
      await waitFor(() => {
        expect(within(dialog).getByText("Saved")).toBeInTheDocument()
      })
      expect(await within(dialog).findByText("Name already exists")).toBeInTheDocument()
      // refreshed so the successful secret shows up
      await waitFor(() => {
        expect(api.listSecrets).toHaveBeenCalledTimes(2)
      })
      // modal stays open for partial failure
      expect(screen.getByText("Import Secrets")).toBeInTheDocument()
    })

    it("resets state and removes secret values from the DOM on cancel", async () => {
      const { user, dialog } = await openImportDialog()

      const textarea = within(dialog).getByLabelText("Paste .env contents")
      await user.type(textarea, "SECRET_NAME=topsecret-value")
      await user.click(within(dialog).getByRole("button", { name: /^Parse$/ }))
      expect(await within(dialog).findByLabelText("Import row 1 value")).toHaveValue("topsecret-value")

      await user.click(within(dialog).getByRole("button", { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByText("Import Secrets")).not.toBeInTheDocument()
      })
      // values are gone from the DOM
      expect(screen.queryByLabelText("Import row 1 value")).not.toBeInTheDocument()
      expect(screen.queryByText("topsecret-value")).not.toBeInTheDocument()
    })
  })
})
