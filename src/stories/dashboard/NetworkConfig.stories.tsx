import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { NetworkConfig, type NetworkConfigData } from '../../dashboard/network-config'

function LiveNetwork() {
  const [config, setConfig] = useState<NetworkConfigData>({ blockOutbound: true, allowList: ['10.0.0.0/8', '192.168.1.0/24'] })
  return <NetworkConfig config={config} onUpdate={(patch) => setConfig((current) => ({ ...current, ...patch }))} className="w-full max-w-[560px]" />
}

const meta = {
  title: 'Dashboard/NetworkConfig',
  component: NetworkConfig,
  args: { config: { blockOutbound: true, allowList: ['10.0.0.0/8'] }, onUpdate: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NetworkConfig>

export default meta
type Story = StoryObj<typeof meta>

export const ManageAllowlist: Story = { render: () => <LiveNetwork /> }
export const Loading: Story = { args: { loading: true, config: null, className: 'w-full max-w-[560px]' } }
