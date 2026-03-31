import type { Meta, StoryObj } from '@storybook/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../primitives/select'

const meta: Meta = {
  title: 'Primitives/Select',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Select region" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
        <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithGroupsAndSeparator: Story = {
  name: 'With Groups & Separator',
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select runtime" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Node.js</SelectLabel>
          <SelectItem value="node-18">Node.js 18 LTS</SelectItem>
          <SelectItem value="node-20">Node.js 20 LTS</SelectItem>
          <SelectItem value="node-22">Node.js 22</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Python</SelectLabel>
          <SelectItem value="python-310">Python 3.10</SelectItem>
          <SelectItem value="python-311">Python 3.11</SelectItem>
          <SelectItem value="python-312">Python 3.12</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Go</SelectLabel>
          <SelectItem value="go-121">Go 1.21</SelectItem>
          <SelectItem value="go-122">Go 1.22</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const WithDefaultValue: Story = {
  name: 'Pre-selected Value',
  render: () => (
    <Select defaultValue="us-east-1">
      <SelectTrigger className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Locked to us-east-1" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithDisabledItem: Story = {
  name: 'With Disabled Item',
  render: () => (
    <Select>
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Select tier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="free">Free</SelectItem>
        <SelectItem value="pro">Pro</SelectItem>
        <SelectItem value="enterprise" disabled>
          Enterprise (contact sales)
        </SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-6 p-6 w-72">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Region</div>
      <Select defaultValue="us-east-1">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
          <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
          <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
          <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
        </SelectContent>
      </Select>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Runtime</div>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select runtime..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Node.js</SelectLabel>
            <SelectItem value="node-20">Node.js 20 LTS</SelectItem>
            <SelectItem value="node-22">Node.js 22</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Python</SelectLabel>
            <SelectItem value="python-311">Python 3.11</SelectItem>
            <SelectItem value="python-312">Python 3.12</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Disabled</div>
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Locked to current plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Free</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
