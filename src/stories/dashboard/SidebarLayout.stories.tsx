import type { Meta, StoryObj } from "@storybook/react"
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
  contentClassName: "flex h-screen flex-col overflow-hidden",
  children: <Body />,
} satisfies Partial<React.ComponentProps<typeof SidebarLayout>>

/** Desktop: the labeled rail, unchanged by the mobile work. */
export const Desktop: Story = {
  args: base,
  parameters: { viewport: { defaultViewport: "responsive" } },
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
