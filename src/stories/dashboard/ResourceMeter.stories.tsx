import type { Meta, StoryObj } from '@storybook/react'
import { Cpu, Database, Wifi, HardDrive } from 'lucide-react'
import { ResourceMeter } from '../../dashboard/resource-meter'

const meta: Meta<typeof ResourceMeter> = {
  title: 'Dashboard/ResourceMeter',
  component: ResourceMeter,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-72 space-y-4 p-6 rounded-xl bg-[var(--depth-2)]">
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'CPU Usage',
    value: 42,
    max: 100,
  },
}

export default meta
type Story = StoryObj<typeof ResourceMeter>

export const LowUsage: Story = {
  name: 'Low usage (20%)',
  args: { label: 'CPU Usage', icon: 'memory', value: 20, max: 100 },
}

export const ModerateUsage: Story = {
  name: 'Moderate usage (45%)',
  args: { label: 'CPU Usage', icon: 'memory', value: 45, max: 100 },
}

export const HighUsage: Story = {
  name: 'High usage (75%)',
  args: { label: 'RAM Usage', icon: 'database', value: 75, max: 100 },
}

export const CriticalUsage: Story = {
  name: 'Critical usage (95%)',
  args: { label: 'Disk I/O', icon: 'hard_drive', value: 95, max: 100 },
}

export const WithUnit: Story = {
  name: 'With unit (RAM GB)',
  args: { label: 'RAM Usage', icon: 'database', value: 6.4, max: 16, unit: 'GB' },
}

export const AllLevels: Story = {
  name: 'All usage levels',
  render: () => (
    <div className="w-72 space-y-6 p-6 rounded-xl bg-[var(--depth-2)]">
      <ResourceMeter label="CPU Usage" icon={<Cpu className="h-3 w-3" />} value={15} max={100} />
      <ResourceMeter label="Memory" icon={<Database className="h-3 w-3" />} value={42} max={100} />
      <ResourceMeter label="Network" icon={<Wifi className="h-3 w-3" />} value={72} max={100} />
      <ResourceMeter label="Disk" icon={<HardDrive className="h-3 w-3" />} value={91} max={100} />
    </div>
  ),
}
