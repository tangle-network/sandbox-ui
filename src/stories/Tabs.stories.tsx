import type { Meta, StoryObj } from '@storybook/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs'

const meta: Meta = {
  title: 'Primitives/Tabs',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm text-muted-foreground">Sandbox is running. Uptime: 4h 12m.</p>
      </TabsContent>
      <TabsContent value="logs">
        <p className="text-sm text-muted-foreground font-mono">stdout: server listening on :3000</p>
      </TabsContent>
      <TabsContent value="metrics">
        <p className="text-sm text-muted-foreground">CPU: 14% · Memory: 312 MB / 512 MB</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Pills: Story = {
  render: () => (
    <Tabs defaultValue="all" className="w-96">
      <TabsList variant="pills">
        <TabsTrigger value="all" variant="pills">All</TabsTrigger>
        <TabsTrigger value="running" variant="pills">Running</TabsTrigger>
        <TabsTrigger value="stopped" variant="pills">Stopped</TabsTrigger>
        <TabsTrigger value="deleted" variant="pills">Deleted</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <p className="text-sm text-muted-foreground">Showing all 12 sandboxes.</p>
      </TabsContent>
      <TabsContent value="running">
        <p className="text-sm text-muted-foreground">3 sandboxes currently running.</p>
      </TabsContent>
      <TabsContent value="stopped">
        <p className="text-sm text-muted-foreground">7 sandboxes stopped.</p>
      </TabsContent>
      <TabsContent value="deleted">
        <p className="text-sm text-muted-foreground">2 sandboxes deleted.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Underline: Story = {
  render: () => (
    <Tabs defaultValue="settings" className="w-96">
      <TabsList variant="underline">
        <TabsTrigger value="settings" variant="underline">Settings</TabsTrigger>
        <TabsTrigger value="env" variant="underline">Environment</TabsTrigger>
        <TabsTrigger value="secrets" variant="underline">Secrets</TabsTrigger>
        <TabsTrigger value="networking" variant="underline">Networking</TabsTrigger>
      </TabsList>
      <TabsContent value="settings">
        <p className="text-sm text-muted-foreground">General sandbox settings.</p>
      </TabsContent>
      <TabsContent value="env">
        <p className="text-sm text-muted-foreground font-mono">NODE_ENV=production</p>
      </TabsContent>
      <TabsContent value="secrets">
        <p className="text-sm text-muted-foreground">3 secrets configured.</p>
      </TabsContent>
      <TabsContent value="networking">
        <p className="text-sm text-muted-foreground">Port 3000 exposed publicly.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const WithDisabledTab: Story = {
  name: 'With Disabled Tab',
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="billing" disabled>Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm text-muted-foreground">Sandbox overview.</p>
      </TabsContent>
      <TabsContent value="logs">
        <p className="text-sm text-muted-foreground font-mono">No recent log output.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-10 p-6 w-[480px]">
      <div>
        <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-4">Default (segmented)</div>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Status: Running · Region: us-east-1 · Uptime: 4h 12m
            </div>
          </TabsContent>
          <TabsContent value="logs">
            <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm text-muted-foreground">
              [INFO] server listening on :3000<br />
              [INFO] connected to database
            </div>
          </TabsContent>
          <TabsContent value="metrics">
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              CPU: 14% · Memory: 312 MB / 512 MB · Net I/O: 1.2 MB/s
            </div>
          </TabsContent>
          <TabsContent value="config">
            <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm text-muted-foreground">
              image: ubuntu:22.04 · cpu: 2 · memory: 512
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-4">Pills</div>
        <Tabs defaultValue="all">
          <TabsList variant="pills">
            <TabsTrigger value="all" variant="pills">All</TabsTrigger>
            <TabsTrigger value="running" variant="pills">Running</TabsTrigger>
            <TabsTrigger value="stopped" variant="pills">Stopped</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <p className="text-sm text-muted-foreground mt-2">Showing all 12 sandboxes.</p>
          </TabsContent>
          <TabsContent value="running">
            <p className="text-sm text-muted-foreground mt-2">3 sandboxes running.</p>
          </TabsContent>
          <TabsContent value="stopped">
            <p className="text-sm text-muted-foreground mt-2">7 sandboxes stopped.</p>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-4">Underline</div>
        <Tabs defaultValue="settings">
          <TabsList variant="underline">
            <TabsTrigger value="settings" variant="underline">Settings</TabsTrigger>
            <TabsTrigger value="env" variant="underline">Environment</TabsTrigger>
            <TabsTrigger value="secrets" variant="underline">Secrets</TabsTrigger>
          </TabsList>
          <TabsContent value="settings">
            <p className="text-sm text-muted-foreground">General sandbox settings.</p>
          </TabsContent>
          <TabsContent value="env">
            <p className="text-sm text-muted-foreground font-mono">NODE_ENV=production</p>
          </TabsContent>
          <TabsContent value="secrets">
            <p className="text-sm text-muted-foreground">3 secrets configured.</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  ),
}
