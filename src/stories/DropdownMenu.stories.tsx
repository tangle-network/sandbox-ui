import type { Meta, StoryObj } from '@storybook/react'
import { ChevronDown, MoreHorizontal, Settings, Terminal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu'

const meta: Meta = {
  title: 'Primitives/DropdownMenu',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  name: 'Default',
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted">
          Options
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Session</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Terminal className="mr-2 h-4 w-4" />
            Open terminal
            <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Configure
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400 focus:text-red-400">
          Terminate session
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const SessionRowMenu: Story = {
  name: 'Session Row Menu',
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" align="end">
        <DropdownMenuItem>View logs</DropdownMenuItem>
        <DropdownMenuItem>Open shell</DropdownMenuItem>
        <DropdownMenuItem>Copy session ID</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Restart</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400 focus:text-red-400">
          Terminate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const RegionSelector: Story = {
  name: 'Region Selector',
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          us-east-1
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal tracking-widest uppercase">
          Regions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <span className="mr-2 h-2 w-2 rounded-full bg-green-400" />
            us-east-1
            <DropdownMenuShortcut className="text-green-400">Online</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span className="mr-2 h-2 w-2 rounded-full bg-green-400" />
            us-west-2
            <DropdownMenuShortcut className="text-green-400">Online</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span className="mr-2 h-2 w-2 rounded-full bg-green-400" />
            eu-central-1
            <DropdownMenuShortcut className="text-green-400">Online</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <span className="mr-2 h-2 w-2 rounded-full bg-muted-foreground" />
            ap-southeast-1
            <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
