import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
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
      const header = getByText(label).closest("div.flex.h-14")
      expect(header).not.toBeNull()
      expect(header).toHaveClass("h-14", "shrink-0")
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
    const header = getByText("Left header").closest("div.flex.h-14")
    expect(header).not.toBeNull()
    expect(header).toHaveClass("h-14", "shrink-0")
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

  it("stays uncontrolled when the props are omitted", () => {
    const { getByLabelText, queryByLabelText } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        leftHeader={<span>Left header</span>}
        center={<div>Center content</div>}
      />,
    )
    expect(getByLabelText("Left workspace panel")).toBeInTheDocument()
    fireEvent.click(getByLabelText("Collapse left panel"))
    expect(queryByLabelText("Left workspace panel")).toBeNull()
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
    // Top-left of the center pane: first child of the center header row.
    expect(control.closest("main")?.firstElementChild?.firstElementChild).toBe(control)
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
  it("keeps the row while a pane exists, even empty, by default", () => {
    const { getByText } = render(
      <WorkspaceLayout left={<div>Left content</div>} center={<div>Center content</div>} resizable={false} />,
    )
    const main = getByText("Center content").closest("main") as HTMLElement
    expect(main.firstElementChild).toHaveClass("h-14")
  })

  it("auto drops the empty row and brings it back with an open-pane toggle", () => {
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
    expect(main.querySelector("div.h-14")).toBeNull()
    expect(queryByLabelText("Open left panel")).toBeNull()

    fireEvent.click(getByLabelText("Collapse left panel"))
    expect(main.querySelector("div.h-14")).not.toBeNull()
    expect(getByLabelText("Open left panel")).toBeInTheDocument()
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
    expect(getByText("Title").closest("div.h-14")).not.toBeNull()
  })
})

describe("WorkspaceLayout — mobile drawers", () => {
  it("opens the left drawer from the mobile toggle", () => {
    mockDesktop(false)
    const { getByLabelText, queryByRole, getByRole, getAllByRole } = render(
      <WorkspaceLayout
        left={<div>Left content</div>}
        center={<div>Center content</div>}
        defaultLeftOpen={false}
      />,
    )
    expect(queryByRole("dialog")).toBeNull()
    fireEvent.click(getByLabelText("Open left panel"))
    expect(getByRole("dialog", { name: "Left workspace panel" })).toBeInTheDocument()
    // Backdrop and the X both close; either proves the drawer is dismissable.
    fireEvent.click(getAllByRole("button", { name: "Close Left workspace panel" })[0]!)
    expect(queryByRole("dialog")).toBeNull()
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
