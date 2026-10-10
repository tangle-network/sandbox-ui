import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import {
  CheckCircle,
  CirclePlus,
  FolderOpen,
  History,
  LayoutGrid,
  Plug,
  Terminal,
} from "lucide-react"
import { SidebarLayout, type SidebarLayoutNavItem } from "../../dashboard/sidebar-layout"
import { ShellHeader } from "../../workspace/shell-header"
import { WorkspaceLayout } from "../../workspace/workspace-layout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives"

/**
 * The app shell four Tangle agent products render. Stories exist mainly to pin
 * the RESPONSIVE contract: below `hideBelow` the rail is `display:none`, and
 * the mobile bar + section drawer are what stand in for it. Before the drawer,
 * that breakpoint simply deleted every destination on a phone.
 */
const NAV: SidebarLayoutNavItem[] = [
  { id: "new", icon: CirclePlus, label: "New", href: "/chat/new", variant: "primary" },
  { id: "vault", icon: FolderOpen, label: "Vault", href: "/vault" },
  { id: "board", icon: LayoutGrid, label: "Board", href: "/board" },
  { id: "approvals", icon: CheckCircle, label: "Approvals", href: "/approvals", badge: 3 },
  { id: "integrations", icon: Plug, label: "Integrations", href: "/integrations" },
  { id: "terminal", icon: Terminal, label: "Terminal", href: "/terminal" },
  {
    id: "history",
    icon: History,
    label: "History",
    href: "/history",
    expandable: true,
    defaultOpen: true,
    subItems: [
      { id: "t1", label: "Q3 competitor teardown", href: "/chat/t1" },
      { id: "t2", label: "Pricing page rewrite", href: "/chat/t2", unread: true },
      { id: "t3", label: "Lifecycle email sequence", href: "/chat/t3" },
    ],
    emptyLabel: "No chats yet",
  },
]

const meta = {
  title: "Dashboard/SidebarLayout",
  component: SidebarLayout,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SidebarLayout>

export default meta
type Story = StoryObj<typeof meta>

const Body = () => (
  <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
    <h1 className="text-2xl font-medium text-foreground">What do you want to work on?</h1>
  </div>
)

const base = {
  navItems: NAV,
  activeId: "vault",
  railLabels: true,
  hideBelow: "lg",
  logo: <span className="text-sm font-semibold text-foreground">Agent</span>,
  logoHref: "/",
  user: { name: "Drew Stone", email: "drew@tangle.tools" },
  onLogout: () => {},
  appearance: { value: "system", onChange: () => {} },
  contentClassName: "flex h-screen flex-col overflow-hidden",
  children: <Body />,
} satisfies Partial<React.ComponentProps<typeof SidebarLayout>>

/** Desktop: the labeled rail, unchanged by the mobile work. */
export const Desktop: Story = {
  args: base,
  parameters: { viewport: { defaultViewport: "responsive" } },
}

/** Expanded app and history groups share the same child-row sizing. */
export const ExpandableGroups: Story = {
  args: {
    ...base,
    activeId: "apps",
    navItems: [
      {
        id: "apps",
        icon: LayoutGrid,
        label: "Apps",
        href: "/apps",
        expandable: true,
        defaultOpen: true,
        subActiveIds: ["app"],
        subItems: [{ id: "app", label: "Sample app", href: "/apps/sample" }],
      },
      {
        id: "history",
        icon: History,
        label: "History",
        href: "/history",
        expandable: true,
        defaultOpen: true,
        subItems: [
          { id: "chat", label: "Recent chat", href: "/chat/recent" },
          { id: "all", label: "View all chats", href: "/history", emphasis: true },
        ],
      },
    ],
  },
}

/**
 * Phone. The rail is hidden by `hideBelow`, so the bar's menu button is the
 * ONLY way into Vault / Board / Approvals / History / Terminal.
 */
export const Mobile: Story = {
  args: base,
  globals: { viewport: { value: "mobile2", isRotated: false } },
}

/** Phone with a docked panel — on a phone it stacks into the same drawer. */
export const MobileWithPanel: Story = {
  args: {
    ...base,
    panel: (
      <div className="p-2 text-sm text-muted-foreground">Thread list panel content</div>
    ),
  },
  globals: { viewport: { value: "mobile2", isRotated: false } },
}

/**
 * A workspace menu whose `open` the product owns, as Hospitality's switcher
 * does. The shell must mount it once, or one click opens one menu per copy.
 */
function ControlledHeaderMenu() {
  const [open, setOpen] = useState(false)
  const header = (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="min-w-0 truncate rounded-lg px-2 py-1 text-sm font-semibold text-foreground">
          ReCenter
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>ReCenter</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpen(false)}>Create workspace</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return <SidebarLayout {...base} railHeaderContent={header} />
}

export const ControlledHeaderMenuStory: Story = {
  name: "Controlled header menu",
  args: base,
  render: () => <ControlledHeaderMenu />,
}

/**
 * The shell with an inset conversation pane and a flat page header beside the
 * rail: every header row is a `ShellHeader`, so each bottom divider lands on the
 * rail's first divider. `tests/visual/shell-header-alignment.spec.mjs` measures it.
 */
export const ShellHeaderAlignment: Story = {
  args: {
    ...base,
    children: (
      <WorkspaceLayout
        surface="inset"
        className="min-h-0 flex-1"
        center={<div className="p-6 text-sm text-muted-foreground">Conversation</div>}
        centerHeader={<span className="px-2 text-sm font-medium text-foreground">Luz confirms the 3 pm massage for Villa 4, long title that must truncate inside the row</span>}
        right={<div className="p-4 text-sm">Files</div>}
        rightHeader={<span className="px-2 text-sm font-medium">Files</span>}
        rightOpenLabel="Open workspace tools"
        rightCloseLabel="Close workspace tools"
        defaultRightOpen
      />
    ),
  },
}

/** A flat page beside the rail: the page header is a `ShellHeader`, never a local height. */
export const ShellHeaderAlignmentPage: Story = {
  args: {
    ...base,
    children: (
      <div className="flex min-h-0 flex-1 flex-col">
        <ShellHeader as="header" data-testid="page-header" className="h-24 min-h-24 px-6" style={{ height: 96 }}>
          <h1 className="text-base font-semibold text-foreground">Messages</h1>
        </ShellHeader>
        <Body />
      </div>
    ),
  },
}
