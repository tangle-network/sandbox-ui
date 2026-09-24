import type { Meta, StoryObj } from '@storybook/react'
import { TemplatesPage } from '../../pages/templates-page'

const templates = [
  { id: 'web', name: 'Next.js + Postgres', description: 'A full-stack web app with a database.', tags: ['TypeScript', 'Web'] },
  { id: 'api', name: 'Python API', description: 'A FastAPI service with tests and a database.', tags: ['Python', 'API'] },
  { id: 'agent', name: 'Agent workspace', description: 'A workspace with tools and evaluation scripts.', tags: ['AI', 'Node.js'] },
]

const meta = {
  title: 'Pages/TemplatesPage',
  component: TemplatesPage,
  args: { templates, onUseTemplate: () => {}, className: 'mx-auto max-w-6xl p-6' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TemplatesPage>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseTemplate: Story = {}
export const NoTemplates: Story = { args: { templates: [] } }
export const Loading: Story = { args: { templates: null, loading: true } }
