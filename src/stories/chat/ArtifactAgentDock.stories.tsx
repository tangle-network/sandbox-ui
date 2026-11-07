import type { Meta, StoryObj } from '@storybook/react'
import { ArtifactAgentDock } from '../../chat/artifact-agent-dock'
import { ArtifactDockFixture, createArtifactDockTransport } from './artifact-dock-fixture'

const meta = {
  title: 'Chat/ArtifactAgentDock',
  component: ArtifactAgentDock,
  args: { scope: { kind: 'vault-file', key: 'src/runtime/retry-policy.ts' }, open: true, onOpenChange: () => {}, transport: createArtifactDockTransport() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ArtifactAgentDock>

export default meta
type Story = StoryObj<typeof meta>

export const ExistingThread: Story = { render: () => <ArtifactDockFixture /> }
export const OpenFromArtifact: Story = { render: () => <ArtifactDockFixture initiallyOpen={false} /> }
