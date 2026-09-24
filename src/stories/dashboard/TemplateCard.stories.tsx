import type { Meta, StoryObj } from '@storybook/react'
import { TemplateCard } from '../../dashboard/template-card'

const meta = {
  title: 'Dashboard/TemplateCard',
  component: TemplateCard,
  args: { template: { id: 'nextjs-postgres', name: 'Next.js + Postgres', description: 'A full-stack app with a database and a development server ready to run.', tags: ['TypeScript', 'Postgres', 'Web'] }, onUseTemplate: () => {}, className: 'w-full max-w-[320px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TemplateCard>

export default meta
type Story = StoryObj<typeof meta>

export const FullStackStarter: Story = {}
