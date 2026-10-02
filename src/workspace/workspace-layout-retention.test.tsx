import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect, useState } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { WorkspaceLayout } from "./workspace-layout"

let desktop = true
let listeners: Array<(event: { matches: boolean }) => void> = []
const mounted = vi.fn()
const disposed = vi.fn()

function StatefulPane() {
  const [text, setText] = useState("")
  useEffect(() => {
    mounted()
    return () => { disposed() }
  }, [])
  return <input aria-label="Terminal input" value={text} onChange={(event) => setText(event.target.value)} />
}

beforeEach(() => {
  desktop = true
  listeners = []
  mounted.mockClear()
  disposed.mockClear()
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener),
      removeEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        listeners = listeners.filter((value) => value !== listener)
      },
      addListener: () => {},
      removeListener: () => {},
    }),
  })
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("WorkspaceLayout retained right content", () => {
  it("lazily creates a retained pane and preserves its DOM through close and responsive relocation", async () => {
    const view = render(<WorkspaceLayout center={<p>Conversation</p>} right={<StatefulPane />} keepRightMounted collapsedControlsPlacement="overlay" />)
    expect(mounted).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Open right panel" }))
    const input = screen.getByRole("textbox", { name: "Terminal input" })
    fireEvent.change(input, { target: { value: "retained scrollback" } })
    fireEvent.click(screen.getByRole("button", { name: "Collapse right panel" }))
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(disposed).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole("button", { name: "Open right panel" })).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "Open right panel" }))
    expect(screen.getByRole("textbox", { name: "Terminal input" })).toBe(input)
    act(() => { desktop = false; listeners.forEach((listener) => listener({ matches: false })) })
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
    expect(screen.getByRole("textbox", { name: "Terminal input" })).toBe(input)
    fireEvent.keyDown(input, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "Open right panel" }))
    act(() => { desktop = true; listeners.forEach((listener) => listener({ matches: true })) })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("textbox", { name: "Terminal input" })).toBe(input)
    expect(input).toHaveValue("retained scrollback")
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(disposed).not.toHaveBeenCalled()
    view.unmount()
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  it("keeps ordinary right panes disposable by default", () => {
    render(<WorkspaceLayout center={<p>Conversation</p>} right={<StatefulPane />} defaultRightOpen />)
    fireEvent.click(screen.getByRole("button", { name: "Collapse right panel" }))
    expect(disposed).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Open right panel" }))
    expect(mounted).toHaveBeenCalledTimes(2)
  })
})
