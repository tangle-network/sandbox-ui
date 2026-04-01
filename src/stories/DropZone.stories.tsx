import type { Meta, StoryObj } from '@storybook/react'
import { Upload, FileText, ImageIcon } from 'lucide-react'
import { DropZone } from '../primitives/drop-zone'

const AppContent = () => (
  <div className="w-[600px] h-[380px] flex items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground text-sm bg-muted">
    App content area — drag files over this window
  </div>
)

const meta: Meta<typeof DropZone> = {
  title: 'Primitives/DropZone',
  component: DropZone,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: {
    onDrop: (files) => console.log('dropped', files),
    children: <AppContent />,
  },
}

export default meta
type Story = StoryObj<typeof DropZone>

export const Idle: Story = {
  name: 'Idle (no drag)',
}

export const WithAcceptFilter: Story = {
  name: 'With Accept Filter (.pdf, .csv)',
  args: {
    accept: '.pdf,.csv',
    title: 'Drop CSV or PDF files',
    description: 'Only .pdf and .csv files will be accepted.',
  },
}

export const Disabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

/** Static render of the default drop overlay — the real one only mounts during dragenter. */
export const OverlayDefault: Story = {
  name: 'Overlay — Default',
  render: () => (
    <div className="relative w-[600px] h-[380px]">
      <AppContent />
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80">
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center max-w-sm w-full mx-4">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-[var(--accent-surface-soft)]">
            <Upload className="h-8 w-8 text-[var(--accent-text)]" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Drop files to upload</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your files will be securely stored in the workspace.</p>
        </div>
      </div>
    </div>
  ),
}

export const OverlayFiltered: Story = {
  name: 'Overlay — Accept filter (.pdf, .csv)',
  render: () => (
    <div className="relative w-[600px] h-[380px]">
      <AppContent />
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80">
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center max-w-sm w-full mx-4">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-[var(--accent-surface-soft)]">
            <FileText className="h-8 w-8 text-[var(--accent-text)]" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Drop CSV or PDF files</h2>
          <p className="mt-2 text-sm text-muted-foreground">Only .pdf and .csv files will be accepted.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full border border-border bg-[var(--accent-surface-soft)] px-2.5 py-1 text-[11px] font-mono text-[var(--accent-text)]">.pdf</span>
            <span className="rounded-full border border-border bg-[var(--accent-surface-soft)] px-2.5 py-1 text-[11px] font-mono text-[var(--accent-text)]">.csv</span>
          </div>
        </div>
      </div>
    </div>
  ),
}

export const OverlayImages: Story = {
  name: 'Overlay — Images',
  render: () => (
    <div className="relative w-[600px] h-[380px]">
      <AppContent />
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80">
        <div className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-card p-12 text-center max-w-sm w-full mx-4">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <ImageIcon className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Drop images here</h2>
          <p className="mt-2 text-sm text-muted-foreground">Accepts .png, .jpg, .webp, .gif</p>
        </div>
      </div>
    </div>
  ),
}

export const OverlayCustom: Story = {
  name: 'Overlay — Custom content',
  render: () => (
    <div className="relative w-[600px] h-[380px]">
      <AppContent />
      <DropZone
        onDrop={(files) => console.log('dropped', files)}
        overlay={
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-background/80">
            <div className="rounded-2xl border-2 border-dashed border-[var(--brand-emerald)]/50 bg-card p-14 text-center">
              <p className="text-2xl font-bold text-[var(--brand-emerald)]">Custom overlay</p>
              <p className="mt-2 text-muted-foreground text-sm">Replace default drop UI with anything.</p>
            </div>
          </div>
        }
      >
        <div className="w-[600px] h-[380px] flex items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground text-sm bg-muted">
          Drag a real file here to trigger custom overlay
        </div>
      </DropZone>
    </div>
  ),
}
