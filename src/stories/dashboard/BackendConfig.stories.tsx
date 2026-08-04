import type { Meta, StoryObj } from '@storybook/react'
import { BackendConfig } from '../../dashboard/backend-config'

const meta: Meta<typeof BackendConfig> = {
  title: 'Dashboard/BackendConfig',
  component: BackendConfig,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[calc(100vw-32px)] max-w-[420px] p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    status: { running: true, model: 'gpt-5', provider: 'openai' },
    mcpServers: [
      {
        name: 'tangle-hub',
        command: 'tangle-hub-mcp-bridge',
        status: 'running',
      },
    ],
    onAddMcp: () => undefined,
    onRemoveMcp: () => undefined,
  },
}

export default meta
type Story = StoryObj<typeof BackendConfig>

export const CommandBasedProvider: Story = {}

export const RestartableProvider: Story = {
  args: { onRestart: () => undefined },
}
