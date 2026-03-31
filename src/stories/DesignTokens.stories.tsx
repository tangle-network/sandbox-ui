import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta = {
  title: 'Design System/Tokens',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj

const ColorSwatch = ({ name, value, label }: { name: string; value: string; label?: string }) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="h-12 w-full rounded-lg border border-[var(--glass-border)]"
      style={{ background: value }}
    />
    <div className="text-foreground text-xs font-medium">{name}</div>
    {label && <div className="text-muted-foreground text-[10px] font-mono">{label}</div>}
  </div>
)

const DepthSwatch = ({ level, hex }: { level: string; hex: string }) => (
  <div className="flex items-center gap-3">
    <div
      className="h-10 w-10 rounded-lg border border-[var(--glass-border)] flex-shrink-0"
      style={{ background: hex }}
    />
    <div>
      <div className="text-foreground text-xs font-medium">{level}</div>
      <div className="text-muted-foreground text-[10px] font-mono">{hex}</div>
    </div>
  </div>
)

const StatusSwatch = ({ name, cssVar, label }: { name: string; cssVar: string; label: string }) => (
  <div className="flex items-center gap-3">
    <div
      className="h-3 w-3 rounded-full flex-shrink-0"
      style={{ background: `var(${cssVar})` }}
    />
    <div>
      <div className="text-foreground text-xs font-medium">{name}</div>
      <div className="text-muted-foreground text-[10px] font-mono">{label}</div>
    </div>
  </div>
)

export const Colors: Story = {
  render: () => (
    <div className="bg-[var(--depth-1)] p-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-10">

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Background Depth</h2>
          <p className="text-muted-foreground text-sm mb-4">4-level hierarchy for layering UI surfaces</p>
          <div className="flex flex-col gap-3">
            <DepthSwatch level="--depth-1 (root)" hex="#08071A" />
            <DepthSwatch level="--depth-2 (surface)" hex="#131228" />
            <DepthSwatch level="--depth-3 (card)" hex="#1C1A3A" />
            <DepthSwatch level="--depth-4 (elevated)" hex="#26244C" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Brand Palette</h2>
          <p className="text-muted-foreground text-sm mb-4">Core identity colors</p>
          <div className="grid grid-cols-3 gap-4">
            <ColorSwatch name="Brand Primary" value="#4a3aff" label="#4a3aff — electric indigo" />
            <ColorSwatch name="Brand Cool" value="#8263FF" label="#8263FF — violet" />
            <ColorSwatch name="Brand Glow" value="#6D6AFF" label="#6D6AFF — periwinkle" />
            <ColorSwatch name="Brand Purple" value="#A78FFF" label="#A78FFF — lavender accent" />
            <ColorSwatch name="Brand Emerald" value="#10b981" label="#10b981 — runtime green" />
            <ColorSwatch name="Text Muted" value="#6B7094" label="#6B7094 — muted label" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Operational Status</h2>
          <p className="text-muted-foreground text-sm mb-4">Infrastructure and agent state vocabulary</p>
          <div className="grid grid-cols-2 gap-3">
            <StatusSwatch name="Running" cssVar="--status-running" label="#10b981" />
            <StatusSwatch name="Creating" cssVar="--status-creating" label="#8263FF" />
            <StatusSwatch name="Stopped" cssVar="--status-stopped" label="#FFB800" />
            <StatusSwatch name="Warm" cssVar="--status-warm" label="#FF8A4C" />
            <StatusSwatch name="Cold" cssVar="--status-cold" label="#4AABFF" />
            <StatusSwatch name="Error" cssVar="--status-error" label="#FF4D6D" />
            <StatusSwatch name="Deleted" cssVar="--status-deleted" label="#6B7094" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Glass Morphism</h2>
          <p className="text-muted-foreground text-sm mb-4">Layered transparency system</p>
          <div className="bg-mesh rounded-xl p-6 flex gap-4">
            <div className="glass-card rounded-xl p-4 flex-1">
              <div className="text-foreground text-sm font-medium mb-1">glass-card</div>
              <div className="text-muted-foreground text-xs">65% opacity · 16px blur</div>
            </div>
            <div className="glass-card-strong rounded-xl p-4 flex-1">
              <div className="text-foreground text-sm font-medium mb-1">glass-card-strong</div>
              <div className="text-muted-foreground text-xs">85% opacity · 24px blur</div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Typography</h2>
          <p className="text-muted-foreground text-sm mb-4">Geist (UI) · Outfit (display) · Geist Mono (code)</p>
          <div className="space-y-3">
            <div style={{ fontFamily: 'var(--font-display)' }} className="text-foreground text-4xl font-bold">
              Display Heading
            </div>
            <div style={{ fontFamily: 'var(--font-sans)' }} className="text-foreground text-xl">
              UI Body — Geist, clean and precise
            </div>
            <div style={{ fontFamily: 'var(--font-mono)' }} className="text-foreground text-sm text-[var(--code-string)]">
              {'const agent = await sandbox.run({ model: "gpt-4o" })'}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-foreground font-semibold text-lg mb-1">Gradients</h2>
          <p className="text-muted-foreground text-sm mb-4">Brand gradient system</p>
          <div className="space-y-3">
            <div className="rounded-lg h-12" style={{ background: 'var(--tangle-gradient)' }} />
            <div className="rounded-lg h-12" style={{ background: 'var(--accent-gradient-strong)' }} />
            <div className="text-gradient-sandbox text-3xl font-bold">
              Gradient Text
            </div>
          </div>
        </div>

      </div>
    </div>
  ),
}

export const StatusDots: Story = {
  name: 'Status Dots',
  render: () => (
    <div className="bg-[var(--depth-1)] p-8 min-h-screen">
      <div className="space-y-6 max-w-sm">
        <h2 className="text-foreground font-semibold text-lg">Status Dot Indicators</h2>
        {[
          { label: 'Running', cls: 'status-dot status-dot-running' },
          { label: 'Creating', cls: 'status-dot status-dot-creating' },
          { label: 'Stopped', cls: 'status-dot status-dot-stopped' },
          { label: 'Warm', cls: 'status-dot status-dot-warm' },
          { label: 'Cold', cls: 'status-dot status-dot-cold' },
          { label: 'Error', cls: 'status-dot status-dot-error' },
          { label: 'Deleted', cls: 'status-dot status-dot-deleted' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={cls} />
            <span className="text-foreground text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}
