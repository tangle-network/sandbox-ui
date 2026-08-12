import type { CSSProperties } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import { RailButton, RailFlyout } from "./app-sidebar"
import { SidebarLayout, type SidebarLayoutNavItem } from "./sidebar-layout"

function Icon() {
  return <svg data-testid="icon" />
}

function navItem(id: string): SidebarLayoutNavItem {
  return { id, label: id, icon: Icon, href: `/${id}` }
}

/** Every CSS timing in the rail must resolve through a token — a literal `ms`
 *  value is unreachable by the `prefers-reduced-motion` collapse at `:root`. */
const HARDCODED_TIMING = /\bduration-\d|\bease-(in|out|linear|in-out)\b/

afterEach(() => {
  vi.useRealTimers()
  // The rail's collapsed state persists to localStorage, which jsdom shares
  // across every test in the file. Without this, a test that toggles the rail
  // silently decides what `defaultRailCollapsed` means for the tests after it.
  localStorage.clear()
})

describe("rail motion — arrival", () => {
  it("staggers nav items by their position in the list", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem("home"), navItem("files"), navItem("runs")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    // The desktop rail and the mobile drawer share one renderer, so a nav item
    // can appear more than once; index is what must line up, per rail.
    const rail = document.querySelector("nav") as HTMLElement
    const items = ["home", "files", "runs"].map(
      (id) => rail.querySelector(`a[href="/${id}"]`) as HTMLElement,
    )
    items.forEach((item, index) => {
      expect(item).toBeTruthy()
      expect(item.className).toMatch(/\bagent-arrive\b/)
      expect(item.style.getPropertyValue("--stagger-index")).toBe(String(index))
    })
  })

  it("keeps --stagger-index when the asChild child brings its own style", () => {
    render(
      <RailButton
        icon={Icon}
        label="Home"
        showLabel
        asChild
        style={{ "--stagger-index": 4 } as CSSProperties}
      >
        <a href="/home" style={{ color: "red" }} />
      </RailButton>,
    )
    const link = document.querySelector('a[href="/home"]') as HTMLElement
    // The layout owns the arrival; a consumer style merged over it would drop
    // the variable silently and flatten the whole rail's entrance to one flash.
    expect(link.style.getPropertyValue("--stagger-index")).toBe("4")
    expect(link.style.color).toBe("red")
  })

  it("does not re-run the entrance when the rail collapses or expands", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem("home"), navItem("files")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const rail = document.querySelector("nav") as HTMLElement
    const before = rail.querySelector('a[href="/home"]')

    // A rail toggle moves nothing off screen, so nothing may arrive. The
    // browser replays a CSS animation when the element is REBUILT, so element
    // identity across the toggle is the whole property: same node, no replay.
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    const collapsed = document.querySelector('nav a[href="/home"]')
    expect(collapsed).toBe(before)

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(document.querySelector('nav a[href="/home"]')).toBe(before)
  })

  it("gives session rows in a rail disclosure the same entrance the rail itself uses", () => {
    render(
      <SidebarLayout
        railLabels
        navItems={[
          {
            id: "history",
            label: "History",
            icon: Icon,
            expandable: true,
            subItems: [{ id: "s1", label: "Session 1", icon: Icon, href: "/c/1" }],
          },
        ]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Expand History" })[0])
    // The disclosure is the animated surface; its rows ride the surface rather
    // than each animating separately, which would double the movement.
    const region = document.querySelector(".agent-disclose") as HTMLElement
    expect(region).toBeTruthy()
    expect(region.getAttribute("data-open")).toBe("true")
  })
})

describe("rail motion — disclosure", () => {
  const expandable: SidebarLayoutNavItem = {
    id: "history",
    label: "History",
    icon: Icon,
    expandable: true,
    subItems: [
      { id: "s1", label: "Session 1", icon: Icon, href: "/c/1" },
      { id: "s2", label: "Session 2", icon: Icon, href: "/c/2" },
    ],
  }

  it("animates its real height (grid rows), not a max-height guess", () => {
    render(
      <SidebarLayout railLabels navItems={[expandable]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const region = document.querySelector(".agent-disclose") as HTMLElement
    expect(region).toBeTruthy()
    // `.agent-disclose` is a grid whose single row travels 0fr -> 1fr, driven
    // entirely by this attribute. No `max-h-*` anywhere near it: a max-height
    // guess either clips a long session list or eases toward a number the
    // content never reaches.
    expect(region.getAttribute("data-open")).toBe("false")
    expect(region.className).not.toMatch(/max-h-/)
    expect(region.firstElementChild?.className ?? "").not.toMatch(/max-h-/)
  })

  it("gives the clipped child no padding, so a closed disclosure is 0px", () => {
    render(
      <SidebarLayout railLabels navItems={[expandable]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const region = document.querySelector(".agent-disclose") as HTMLElement
    const clipped = region.firstElementChild as HTMLElement
    // `.agent-disclose > *` is the element the 0fr row sizes to 0. A border-box
    // height of 0 still floors at padding + border, so padding HERE survives
    // the collapse: `pt-0.5` leaves a closed disclosure 2px tall. Spacing lives
    // one level in, where the clip hides it.
    expect(clipped.className).not.toMatch(/\bp[trblxyse]?-/)
    expect((clipped.firstElementChild as HTMLElement).className).toMatch(/\bpt-0\.5\b/)
  })

  it("keeps the collapsed region out of the tab order and the a11y tree", () => {
    render(
      <SidebarLayout railLabels navItems={[expandable]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const toggle = screen.getAllByRole("button", { name: "Expand History" })[0]
    const region = document.querySelector(".agent-disclose") as HTMLElement
    // Closed and never opened: nothing to reach, and `inert` in place for the
    // moment there is.
    expect(region).toHaveAttribute("inert")
    expect(toggle).toHaveAttribute("aria-controls", region.id)

    fireEvent.click(toggle)
    expect(region.getAttribute("data-open")).toBe("true")
    expect(region).not.toHaveAttribute("inert")
    expect(screen.getByText("Session 1")).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: "Collapse History" })[0])
    // Still mounted — a list that unmounts on close has no height to collapse
    // and snaps shut — but clipped content must not stay tabbable.
    expect(screen.getByText("Session 1")).toBeInTheDocument()
    expect(region.getAttribute("data-open")).toBe("false")
    expect(region).toHaveAttribute("inert")
  })
})

describe("rail motion — tokens", () => {
  it("times hover and active state from a token, never a literal", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem("home")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const item = document.querySelector('nav a[href="/home"]') as HTMLElement
    expect(item.className).toContain("duration-[var(--duration-fast)]")
    expect(item.className).toContain("ease-[var(--ease-standard)]")
    expect(item.className).not.toMatch(HARDCODED_TIMING)
  })

  it("times the rail's own travel and the content margin from the SAME token", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem("home")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const rail = document.querySelector('[data-sidebar="true"]') as HTMLElement
    const main = document.querySelector("main") as HTMLElement
    // Two different tiers here means the page content visibly lags the edge it
    // is supposed to be attached to.
    expect(rail.className).toContain("duration-[var(--duration-slow)]")
    expect(main.className).toContain("duration-[var(--duration-slow)]")
    expect(rail.className).not.toMatch(HARDCODED_TIMING)
    expect(main.className).not.toMatch(HARDCODED_TIMING)
  })
})

describe("rail motion — essential signals", () => {
  it("exempts a responding session's shimmer from the reduced-motion floor", () => {
    render(
      <SidebarLayout
        railLabels
        navItems={[
          {
            id: "history",
            label: "History",
            icon: Icon,
            expandable: true,
            defaultOpen: true,
            subItems: [{ id: "s1", label: "Working session", icon: Icon, href: "/c/1", isLoading: true }],
          },
        ]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    const label = screen.getAllByText("Working session")[0]
    // The sweep through the glyphs is the only thing separating "still working"
    // from "stuck", so it survives `prefers-reduced-motion`.
    expect(label.className).toMatch(/\bagent-shimmer\b/)
    expect(label).toHaveAttribute("data-motion", "essential")
  })

  it("leaves decorative rail motion unmarked", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem("home")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const item = document.querySelector('nav a[href="/home"]') as HTMLElement
    expect(item).not.toHaveAttribute("data-motion")
  })
})

describe("rail motion — floating surfaces", () => {
  it("pops the hover tooltip in without eating its centering transform", () => {
    vi.useFakeTimers()
    render(
      <SidebarLayout railLabels defaultRailCollapsed navItems={[navItem("home")]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const trigger = document.querySelector('nav a[href="/home"]')?.parentElement as HTMLElement
    fireEvent.mouseOver(trigger)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    const tip = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(tip).toBeTruthy()
    expect(tip.className).toMatch(/\bagent-pop-in\b/)
    // `.agent-pop-in` fills forwards to `transform: none`, so the positioning
    // transform has to live on a different element or every tooltip lands half
    // a line low.
    expect(tip.style.transform).toBe("")
    expect((tip.parentElement as HTMLElement).style.transform).toBe("translateY(-50%)")
  })

  it("kills a pending tooltip when the trigger stops being tooltipped", () => {
    vi.useFakeTimers()
    render(
      <RailFlyout icon={Icon} label="Studio">
        <a href="/studio/runs">Runs</a>
      </RailFlyout>,
    )
    const trigger = screen.getByRole("button", { name: "Studio" })
    const wrapper = trigger.parentElement as HTMLElement

    // Hover arms the 250ms open, then the user clicks inside that window — the
    // flyout opens and `disabled` goes true, which suppresses the tooltip.
    fireEvent.mouseOver(wrapper)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.click(trigger)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(document.querySelector('[role="tooltip"]')).toBeNull()

    // Closing the flyout re-enables the tooltip. The wrapper never unmounted
    // across either toggle, so nothing but the `disabled` effect can have
    // cancelled the armed timer — if it did not, the tooltip it queued arrives
    // here, on a trigger the pointer only ever passed over.
    fireEvent.keyDown(document, { key: "Escape" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it("pops the collapsed-rail flyout in rather than snapping it open", () => {
    render(
      <SidebarLayout
        railLabels
        defaultRailCollapsed
        navItems={[
          {
            id: "history",
            label: "History",
            icon: Icon,
            href: "/history",
            expandable: true,
            subItems: [{ id: "s1", label: "Session 1", icon: Icon, href: "/c/1" }],
          },
        ]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    const wrapper = (document.querySelector('a[href="/history"]') as HTMLElement).parentElement as HTMLElement
    fireEvent.mouseOver(wrapper)
    const flyout = document.querySelector('[role="menu"]') as HTMLElement
    expect(flyout).toBeTruthy()
    expect(flyout.className).toMatch(/\bagent-pop-in\b/)
  })
})
