import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { PortsList, type ExposedPort } from '../../dashboard/ports-list'

function LivePorts() {
  const [ports, setPorts] = useState<ExposedPort[]>([
    { port: 3000, url: 'https://3000.preview.example.com', status: 'active' },
    { port: 5432, url: 'https://5432.preview.example.com', status: 'pending' },
  ])
  return <PortsList ports={ports} onExposePort={(port) => setPorts((current) => [...current, { port, url: `https://${port}.preview.example.com`, status: 'pending' }])} onRemovePort={(port) => setPorts((current) => current.filter((item) => item.port !== port))} className="w-full max-w-[700px]" />
}

const meta = {
  title: 'Dashboard/PortsList',
  component: PortsList,
  args: { ports: [], onExposePort: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PortsList>

export default meta
type Story = StoryObj<typeof meta>

export const ExposedPorts: Story = { render: () => <LivePorts /> }
export const NoPorts: Story = { args: { className: 'w-full max-w-[700px]' } }
