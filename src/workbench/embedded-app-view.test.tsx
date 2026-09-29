import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { EmbeddedAppView } from "./embedded-app-view"

const app = { id: "reporting", name: "Reporting" }

describe("EmbeddedAppView", () => {
  it("mounts only the active app's authorized frame after the host marks it ready", () => {
    const { container, rerender } = render(<EmbeddedAppView app={{ ...app, status: "starting" }} />)
    expect(screen.getByRole("status")).toHaveTextContent("starting")
    expect(container.querySelector("iframe")).toBeNull()

    rerender(<EmbeddedAppView app={{ ...app, status: "ready", previewUrl: "https://preview.example.test/report" }} />)
    expect(container.querySelector("iframe")).toHaveAttribute("src", "https://preview.example.test/report")
    expect(container.querySelector("iframe")).toHaveAttribute("title", "Reporting")
    expect(screen.queryByRole("textbox", { name: "Preview address" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Reporting in new tab" })).toHaveAttribute("href", "https://preview.example.test/report")

    rerender(<EmbeddedAppView app={{ ...app, status: "unavailable" }} />)
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable")
  })

  it("shows only service-supplied readiness and enforced access metadata", () => {
    render(
      <EmbeddedAppView
        app={{ ...app, status: "ready", previewUrl: "https://preview.example.test/" }}
        readiness={{ state: "ready", checkedAt: "2026-09-29T00:00:00Z", statusCode: 200 }}
        access={{ state: "public", source: "enforced-policy" }}
      />,
    )
    expect(screen.getByText("Application responded: HTTP 200")).toBeInTheDocument()
    expect(screen.getByText("Public URL")).toBeInTheDocument()
  })

  it("rejects a preview origin outside the host's approved set", () => {
    const { container } = render(
      <EmbeddedAppView
        app={{ ...app, status: "ready", previewUrl: "https://outside.example.test/" }}
        allowedOrigins={["https://preview.example.test"]}
      />,
    )
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("not approved")
  })

  it("never mounts a frame or open link for an invalid address and offers host retry", () => {
    const retry = vi.fn()
    const { container } = render(<EmbeddedAppView app={{ ...app, status: "ready", previewUrl: "https://user:secret@preview.example.test/" }} onRetry={retry} />)
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("must not contain credentials")
    fireEvent.click(screen.getByRole("button", { name: "Retry preview" }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
