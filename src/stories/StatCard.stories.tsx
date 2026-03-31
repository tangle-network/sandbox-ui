import type { Meta, StoryObj } from '@storybook/react'
import { Activity, Cpu, DollarSign, HardDrive, Terminal, Users, Zap } from 'lucide-react'
import { StatCard } from '../primitives/stat-card'

const meta: Meta<typeof StatCard> = {
  title: 'Primitives/StatCard',
  component: StatCard,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: {
    title: 'Active Sessions',
    value: 24,
    subtitle: 'across 3 regions',
    icon: <Terminal className="h-5 w-5" />,
  },
}

export const SandboxVariant: Story = {
  name: 'Sandbox Variant',
  args: {
    variant: 'sandbox',
    title: 'Active Sessions',
    value: 24,
    subtitle: 'across 3 regions',
    icon: <Terminal className="h-5 w-5" />,
    trend: { value: 12, label: 'vs last hour' },
  },
}

export const CpuUsage: Story = {
  name: 'CPU Usage',
  args: {
    title: 'Avg CPU Usage',
    value: '68%',
    subtitle: 'p95: 94%',
    icon: <Cpu className="h-5 w-5" />,
    trend: { value: -4, label: 'vs yesterday' },
  },
}

export const MemoryUsage: Story = {
  name: 'Memory Usage',
  args: {
    title: 'Memory Allocated',
    value: '12.4 GB',
    subtitle: 'of 32 GB pool',
    icon: <HardDrive className="h-5 w-5" />,
    trend: { value: 8, label: 'vs last hour' },
  },
}

export const MonthlyCost: Story = {
  name: 'Monthly Cost',
  args: {
    title: 'Estimated Cost',
    value: '$142.80',
    subtitle: 'current billing cycle',
    icon: <DollarSign className="h-5 w-5" />,
    trend: { value: 0, label: 'vs last month' },
  },
}

export const TrendPositive: Story = {
  name: 'Trend — Positive',
  args: {
    title: 'Sessions Today',
    value: 1284,
    icon: <Activity className="h-5 w-5" />,
    trend: { value: 23, label: 'vs yesterday' },
  },
}

export const TrendNegative: Story = {
  name: 'Trend — Negative',
  args: {
    title: 'Error Rate',
    value: '1.2%',
    icon: <Zap className="h-5 w-5" />,
    trend: { value: -18, label: 'vs last week' },
  },
}

export const InfraGrid: Story = {
  name: 'Infrastructure Grid',
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[640px]">
      <StatCard
        title="Active Sessions"
        value={24}
        subtitle="across 3 regions"
        icon={<Terminal className="h-5 w-5" />}
        trend={{ value: 12, label: 'vs last hour' }}
      />
      <StatCard
        title="CPU Usage"
        value="68%"
        subtitle="p95: 94%"
        icon={<Cpu className="h-5 w-5" />}
        trend={{ value: -4, label: 'vs yesterday' }}
      />
      <StatCard
        title="Memory Allocated"
        value="12.4 GB"
        subtitle="of 32 GB pool"
        icon={<HardDrive className="h-5 w-5" />}
        trend={{ value: 8, label: 'vs last hour' }}
      />
      <StatCard
        variant="sandbox"
        title="Estimated Cost"
        value="$142.80"
        subtitle="current billing cycle"
        icon={<DollarSign className="h-5 w-5" />}
        trend={{ value: 3, label: 'vs last month' }}
      />
      <StatCard
        title="Unique Users"
        value={312}
        subtitle="last 30 days"
        icon={<Users className="h-5 w-5" />}
        trend={{ value: 19, label: 'MoM' }}
      />
      <StatCard
        title="Avg Startup Time"
        value="840ms"
        subtitle="p99: 1.4s"
        icon={<Zap className="h-5 w-5" />}
        trend={{ value: -11, label: 'vs last week' }}
      />
    </div>
  ),
}
