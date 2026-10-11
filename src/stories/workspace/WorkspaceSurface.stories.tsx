import type { Meta, StoryObj } from '@storybook/react'
import { WorkspaceSurface } from '../../workspace/workspace-surface'

const meta: Meta<typeof WorkspaceSurface> = {
  title: 'Workspace/WorkspaceSurface',
  component: WorkspaceSurface,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, context) => (
      <div
        className="flex h-screen"
        data-sandbox-ui="true"
        data-sandbox-theme={context.globals.sandboxTheme === 'light' ? 'vault' : undefined}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof WorkspaceSurface>

const assets = ['Launch teaser.mp4', 'Hero still, 16:9.png', 'Voiceover, take 3.wav', 'Storyboard v2.pdf', 'Brand palette.png', 'Cutdown, 15 s.mp4']

/** A non-chat page (an asset library) on the chat's floating panel. */
export const Default: Story = {
  args: {
    title: 'Assets',
    actions: (
      <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm">
        Upload
      </button>
    ),
    children: (
      <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {assets.map((name) => (
          <li key={name} className="rounded-lg border border-border bg-card p-3 text-sm">
            {name}
          </li>
        ))}
      </ul>
    ),
  },
}
