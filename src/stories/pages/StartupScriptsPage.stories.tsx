import type { Meta, StoryObj } from '@storybook/react'
import { StartupScriptsPage, type StartupScript, type StartupScriptFormData, type StartupScriptsApiClient } from '../../pages/startup-scripts-page'

const initial: StartupScript = {
  id: 'script-1', name: 'Install dependencies', description: 'Prepare the workspace before the first session.', scriptType: 'bash',
  content: '#!/bin/bash\nset -e\npnpm install --frozen-lockfile', environments: [], minCpuCores: null, minRamGB: null,
  runOrder: 1, timeoutSeconds: 120, continueOnFailure: false, runAsRoot: false, injectSecrets: [], enabled: true,
  createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z',
}

function makeApiClient(start: StartupScript[] = [initial]): StartupScriptsApiClient {
  let scripts = [...start]
  return {
    async listScripts() { return [...scripts] },
    async createScript(data: StartupScriptFormData) { const script = { ...data, id: `script-${scripts.length + 1}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; scripts = [...scripts, script]; return script },
    async updateScript(id: string, patch: Partial<StartupScriptFormData>) { const script = { ...scripts.find((item) => item.id === id)!, ...patch, updatedAt: new Date().toISOString() }; scripts = scripts.map((item) => item.id === id ? script : item); return script },
    async deleteScript(id: string) { scripts = scripts.filter((item) => item.id !== id) },
    async toggleScript(id: string) { const script = scripts.find((item) => item.id === id)!; return this.updateScript(id, { enabled: !script.enabled }) },
    async listSecrets() { return [{ name: 'DATABASE_URL' }] },
    async listEnvironments() { return [{ id: 'default', name: 'Default' }] },
  }
}

const meta = {
  title: 'Pages/StartupScriptsPage',
  component: StartupScriptsPage,
  args: { apiClient: makeApiClient(), className: 'mx-auto max-w-5xl p-6' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StartupScriptsPage>

export default meta
type Story = StoryObj<typeof meta>

export const ManageScripts: Story = { render: () => <StartupScriptsPage apiClient={makeApiClient()} className="mx-auto max-w-5xl p-6" /> }
export const Empty: Story = { render: () => <StartupScriptsPage apiClient={makeApiClient([])} className="mx-auto max-w-5xl p-6" /> }
