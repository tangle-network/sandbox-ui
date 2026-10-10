import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WorkspaceLayout } from "./workspace-layout"

function mockDesktop(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  mockDesktop(true)
})

describe("WorkspaceLayout — theme", () => {
  it("sets data-sandbox-theme='vault' when vault theme is provided", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} theme="vault" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("data-sandbox-ui")).toBe("true")
    expect(root.getAttribute("data-sandbox-theme")).toBe("vault")
  })

  it("sets no data attributes when theme is undefined", () => {
    const { container } = render(
      <WorkspaceLayout center={<div />} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.hasAttribute("data-sandbox-ui")).toBe(false)
    expect(root.hasAttribute("data-sandbox-theme")).toBe(false)
  })
})

describe("WorkspaceLayout — top header alignment", () => {
  it("pins every desktop pane header to the shell's 56px row", () => {
    const { getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
        centerHeader={<span>Center header</span>}
        right={<div>Right content</div>}
        rightHeader={<span>Right header</span>}
        defaultRightOpen
        resizable={false}
      />,
    )

    for (const label of ["Left header", "Center header", "Right header"]) {
      const header = getByText(label).closest("[data-shell-header]")
      expect(header).not.toBeNull()
      expect(header).toHaveStyle({ height: "var(--shell-header-height, 3.5rem)" })
      expect(header?.className).not.toMatch(/\bpy-/)
    }
  })

  it("uses the same 56px row for mobile drawer headers", () => {
    mockDesktop(false)

    const { getByRole, getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
      />,
    )

    expect(getByRole("dialog", { name: "Left workspace panel" })).toBeInTheDocument()
    const header = getByText("Left header").closest("[data-shell-header]")
    expect(header).not.toBeNull()
    expect(header).toHaveStyle({ height: "var(--shell-header-height, 3.5rem)" })
    expect(header?.className).not.toMatch(/\bpy-/)
  })
})

describe("WorkspaceLayout — controlled panes", () => {
  it("reads leftOpen from the prop and only reports a change", () => {
    const onLeftOpenChange = vi.fn()
    const { queryByLabelText, getByLabelText, rerender } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        leftOpen={false}
        onLeftOpenChange={onLeftOpenChange}
      />,
    )
    expect(queryByLabelText("Left workspace panel")).toBeNull()

    fireEvent.click(getByLabelText("Open left panel"))
    expect(onLeftOpenChange).toHaveBeenCalledWith(true)
    // Controlled: the pane stays closed until the owner says otherwise.
    expect(queryByLabelText("Left workspace panel")).toBeNull()

    rerender(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        leftOpen
        onLeftOpenChange={onLeftOpenChange}
      />,
    )
    expect(getByLabelText("Left workspace panel")).toBeInTheDocument()
  })

  it("reads rightOpen from the prop and reports the collapse", () => {
    const onRightOpenChange = vi.fn()
    const { getByLabelText } = render(
      <WorkspaceLayout
        right={<div>Right content</div>}
        center={<div>Center content</div>}
        rightOpen
        onRightOpenChange={onRightOpenChange}
        resizable={false}
      />,
    )
    fireEvent.click(getByLabelText("Collapse right panel"))
    expect(onRightOpenChange).toHaveBeenCalledWith(false)
    expect(getByLabelText("Right workspace panel")).toBeInTheDocument()
  })

  it("stays uncontrolled and restores focus to the edge control after collapse", async () => {
    const { getByLabelText, queryByLabelText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
      />,
    )
    expect(getByLabelText("Left workspace panel")).toBeInTheDocument()
    getByLabelText("Collapse left panel").focus()
    fireEvent.click(getByLabelText("Collapse left panel"))
    expect(queryByLabelText("Left workspace panel")).toBeNull()
    await waitFor(() => expect(getByLabelText("Open left panel")).toHaveFocus())
  })
})

describe("WorkspaceLayout — keyboard shortcuts", () => {
  function renderShell(keyboardShortcuts = true) {
    return render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={
          <div>
            <input aria-label="Composer" />
            <div contentEditable="true" data-testid="editor">
              <span>Rich text</span>
            </div>
          </div>
        }
        right={<div>Right content</div>}
        defaultRightOpen
        resizable={false}
        keyboardShortcuts={keyboardShortcuts}
      />,
    )
  }

  it("toggles the left pane on ⌘B / Ctrl+B and the right pane on ⌘E / Ctrl+E", () => {
    const { queryByLabelText } = renderShell()
    expect(queryByLabelText("Left workspace panel")).not.toBeNull()
    fireEvent.keyDown(window, { key: "b", metaKey: true })
    expect(queryByLabelText("Left workspace panel")).toBeNull()
    fireEvent.keyDown(window, { key: "B", ctrlKey: true })
    expect(queryByLabelText("Left workspace panel")).not.toBeNull()

    expect(queryByLabelText("Right workspace panel")).not.toBeNull()
    fireEvent.keyDown(window, { key: "e", ctrlKey: true })
    expect(queryByLabelText("Right workspace panel")).toBeNull()
    fireEvent.keyDown(window, { key: "e", metaKey: true })
    expect(queryByLabelText("Right workspace panel")).not.toBeNull()
  })

  it("ignores the chord while typing, and any Alt or Shift variant", () => {
    const { getByLabelText, getByTestId, getByText, queryByLabelText } = renderShell()
    fireEvent.keyDown(getByLabelText("Composer"), { key: "b", metaKey: true })
    fireEvent.keyDown(getByText("Rich text"), { key: "b", metaKey: true })
    fireEvent.keyDown(getByTestId("editor"), { key: "e", metaKey: true })
    fireEvent.keyDown(window, { key: "b", metaKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: "b", ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: "b" })
    expect(queryByLabelText("Left workspace panel")).not.toBeNull()
    expect(queryByLabelText("Right workspace panel")).not.toBeNull()
  })

  it("is off by default", () => {
    const { queryByLabelText } = renderShell(false)
    fireEvent.keyDown(window, { key: "b", metaKey: true })
    expect(queryByLabelText("Left workspace panel")).not.toBeNull()
  })
})

describe("WorkspaceLayout — collapsed left control", () => {
  it("renders the consumer's control in place of the default open button", () => {
    const { getByText, queryByLabelText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        defaultLeftOpen={false}
        leftCollapsedControl={<button type="button">Show chats</button>}
      />,
    )
    const control = getByText("Show chats")
    expect(control).toBeInTheDocument()
    expect(queryByLabelText("Open left panel")).toBeNull()
    const main = control.closest("main") as HTMLElement
    expect(main.querySelector("[data-shell-header]")).toBeNull()
    expect(control.parentElement).toHaveClass("shrink-0", "pt-2")
  })

  it("keeps the default button while the control is omitted", () => {
    const { getByLabelText } = render(
      <WorkspaceLayout left={<div>Left content</div>} center={<div>Center content</div>} defaultLeftOpen={false} />,
    )
    expect(getByLabelText("Open left panel")).toBeInTheDocument()
  })
})

describe("WorkspaceLayout — pane content classes", () => {
  it("lets a rail drop the left gutter", () => {
    const { getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        leftContentClassName="py-0"
      />,
    )
    const wrapper = getByText("Left content").parentElement as HTMLElement
    expect(wrapper.className).toMatch(/\bpy-0\b/)
    expect(wrapper.className).not.toMatch(/\bpy-1\b/)
  })

  it("keeps the left gutter by default", () => {
    const { getByText } = render(
      <WorkspaceLayout left={<div>Left content</div>} center={<div>Center content</div>} />,
    )
    expect((getByText("Left content").parentElement as HTMLElement).className).toMatch(/\bpy-1\b/)
  })
})

describe("WorkspaceLayout — center header visibility", () => {
  it("does not reserve an empty center row by default", () => {
    const { getByText } = render(
      <WorkspaceLayout left={<div>Left content</div>} center={<div>Center content</div>} resizable={false} />,
    )
    const main = getByText("Center content").closest("main") as HTMLElement
    expect(main.querySelector("[data-shell-header]")).toBeNull()
  })

  it("keeps the aligned row when explicitly requested", () => {
    const { getByText } = render(
      <WorkspaceLayout left={<div>Left content</div>} center={<div>Center content</div>} centerHeaderVisibility="always" />,
    )
    expect(getByText("Center content").closest("main")?.querySelector("[data-shell-header]")).not.toBeNull()
  })

  it("auto keeps the center row absent when a pane closes", () => {
    const { getByText, getByLabelText, queryByLabelText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
        centerHeaderVisibility="auto"
        resizable={false}
      />,
    )
    const main = getByText("Center content").closest("main") as HTMLElement
    expect(main.querySelector("[data-shell-header]")).toBeNull()
    expect(queryByLabelText("Open left panel")).toBeNull()

    fireEvent.click(getByLabelText("Collapse left panel"))
    expect(main.querySelector("[data-shell-header]")).toBeNull()
    const reopen = getByLabelText("Open left panel")
    expect(reopen).toBeInTheDocument()
    expect(reopen.parentElement).toHaveClass("shrink-0", "pt-2")
    fireEvent.click(reopen)
    expect(queryByLabelText("Open left panel")).toBeNull()
    expect(getByLabelText("Left workspace panel")).toBeInTheDocument()
  })

  it("auto keeps the row while a centerHeader is given", () => {
    const { getByText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        centerHeader={<span>Title</span>}
        centerHeaderVisibility="auto"
        resizable={false}
      />,
    )
    expect(getByText("Title").closest("[data-shell-header]")).not.toBeNull()
  })
})

describe("WorkspaceLayout — mobile drawers", () => {
  it("opens the left drawer from the mobile toggle", () => {
    mockDesktop(false)
    const { getByLabelText, queryByRole, getByRole } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        defaultLeftOpen={false}
      />,
    )
    expect(queryByRole("dialog")).toBeNull()
    fireEvent.click(getByLabelText("Open left panel"))
    expect(getByRole("dialog", { name: "Left workspace panel" })).toBeInTheDocument()
    fireEvent.click(getByRole("button", { name: "Close Left workspace panel" }))
    expect(queryByRole("dialog")).toBeNull()
  })

  it("focuses and traps the drawer, then returns focus to its edge control on Escape", async () => {
    mockDesktop(false)
    const user = userEvent.setup()
    const { getByLabelText, getByRole, queryByRole } = render(
      <WorkspaceLayout left={<button type="button">Session action</button>} center={<div>Center content</div>} defaultLeftOpen={false} />,
    )
    const reopen = getByLabelText("Open left panel")
    await user.click(reopen)
    const dialog = getByRole("dialog", { name: "Left workspace panel" })
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard("{Escape}")
    expect(queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(getByLabelText("Open left panel")).toHaveFocus())
  })

  it("opens the right drawer from the mobile toggle", () => {
    mockDesktop(false)
    const { getByLabelText, queryByRole, getByRole } = render(
      <WorkspaceLayout right={<div>Right content</div>} center={<div>Center content</div>} />,
    )
    expect(queryByRole("dialog")).toBeNull()
    fireEvent.click(getByLabelText("Open right panel"))
    expect(getByRole("dialog", { name: "Right workspace panel" })).toBeInTheDocument()
  })
})

describe("WorkspaceLayout — center width floor", () => {
  function withShellWidth(width: number) {
    let callback: ResizeObserverCallback | null = null
    // A class, not an arrow: the layout constructs the observer with `new`.
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = cb
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: FakeResizeObserver })
    const view = render(
      <WorkspaceLayout
        left={<div>rail</div>}
        right={<div>artifacts</div>}
        defaultLeftOpen
        defaultRightOpen
        defaultLeftWidth={280}
        defaultRightWidth={480}
        center={<div>center</div>}
      />,
    )
    const fire = (w: number) => {
      const entry = { contentRect: { width: w } } as ResizeObserverEntry
      act(() => callback?.([entry], {} as ResizeObserver))
    }
    fire(width)
    const left = view.container.querySelector('[aria-label="Left workspace panel"]') as HTMLElement
    const right = view.container.querySelector('[aria-label="Right workspace panel"]') as HTMLElement
    return { left, right, fire }
  }

  it("keeps the stored widths while the shell has room", () => {
    const { left, right } = withShellWidth(1600)
    expect(left.style.width).toBe("280px")
    expect(right.style.width).toBe("480px")
  })

  it("shrinks the right pane first so the center keeps 400px", () => {
    const { left, right } = withShellWidth(1024)
    expect(right.style.width).toBe("344px")
    expect(left.style.width).toBe("280px")
  })

  it("then shrinks the left pane, and restores both when room returns", () => {
    const { left, right, fire } = withShellWidth(900)
    expect(right.style.width).toBe("320px")
    expect(left.style.width).toBe("220px")
    fire(1600)
    expect(right.style.width).toBe("480px")
    expect(left.style.width).toBe("280px")
  })
})

describe("WorkspaceLayout — inset surface", () => {
  const inset = (props: Partial<Parameters<typeof WorkspaceLayout>[0]> = {}) => (
    <WorkspaceLayout
      surface="inset"
      center={<div>Conversation</div>}
      centerHeader={<span>Launch plan</span>}
      right={<div>Files content</div>}
      rightHeader={<span>Tools</span>}
      rightOpenLabel="Open workspace tools"
      rightCloseLabel="Close workspace tools"
      rightControlHint="Files, Agent, Terminal"
      {...props}
    />
  )

  it("keeps a closed right pane's control flat inside the center header and leaves nothing at the edge", () => {
    const { container, getByRole } = render(inset())
    const surface = container.querySelector("[data-workspace-surface]")
    const header = container.querySelector('[data-workspace-header="center"]')
    const toggle = getByRole("button", { name: "Open workspace tools" })
    expect(surface).not.toBeNull()
    expect(header).not.toBeNull()
    expect(surface?.contains(header)).toBe(true)
    expect(header?.contains(toggle)).toBe(true)
    expect(header).toHaveAttribute("data-shell-header", "inset")
    expect(toggle).toHaveClass("size-8")
    expect(toggle.className.split(" ").filter((name) => name === "border" || name.startsWith("shadow") || name.startsWith("bg-card"))).toEqual([])
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(container.querySelector('[data-workspace-pane="right"]')).toBeNull()
    // The surface is the shell's last column: no edge column follows it.
    expect(surface?.parentElement?.nextElementSibling).toBeNull()
    expect(surface?.parentElement).toHaveClass("p-[var(--shell-inset-gutter,0.5rem)]")
  })

  it("opens the right pane inside the same surface with an aligned header and returns focus on close", async () => {
    const user = userEvent.setup()
    const { container, getByRole } = render(inset())
    await user.click(getByRole("button", { name: "Open workspace tools" }))
    const surface = container.querySelector("[data-workspace-surface]")
    const pane = container.querySelector('[data-workspace-pane="right"]')
    expect(surface?.contains(pane)).toBe(true)
    expect(pane).toHaveClass("bg-transparent")
    const paneHeader = pane?.firstElementChild
    expect(paneHeader).toHaveAttribute("data-shell-header", "inset")
    expect(container.querySelector('[data-workspace-header="center"]')).toHaveAttribute("data-shell-header", "inset")
    expect(getByRole("separator", { name: "Resize right panel" })).toBeTruthy()
    const close = getByRole("button", { name: "Close workspace tools" })
    expect(close).toHaveAttribute("aria-expanded", "true")
    await user.click(close)
    await waitFor(() => expect(document.activeElement).toBe(getByRole("button", { name: "Open workspace tools" })))
  })

  it("names the pane's tools in the toggle's tooltip on keyboard focus", async () => {
    const user = userEvent.setup()
    const { getByRole, findAllByText } = render(inset())
    await user.tab()
    expect(document.activeElement).toBe(getByRole("button", { name: "Open workspace tools" }))
    expect((await findAllByText("Files, Agent, Terminal")).length).toBeGreaterThan(0)
  })

  it("keeps the header row even without header content so a closed pane still has its control", () => {
    const { container, getByRole } = render(inset({ centerHeader: undefined }))
    const header = container.querySelector('[data-workspace-header="center"]')
    expect(header?.contains(getByRole("button", { name: "Open workspace tools" }))).toBe(true)
  })

  it("defaults to the flat edge layout", () => {
    const { container, getByRole } = render(<WorkspaceLayout center={<div>Chat</div>} right={<div>Right</div>} />)
    expect(container.querySelector("[data-workspace-surface]")).toBeNull()
    expect(getByRole("button", { name: "Open right panel" })).toHaveClass("h-10", "w-8")
  })
})
