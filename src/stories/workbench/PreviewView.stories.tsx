import type { Meta, StoryObj } from '@storybook/react'
import { PreviewView } from '../../workbench/preview-view'

const page = '<!doctype html><html><body style="font:16px system-ui;padding:48px;color:#24233d"><h1>Northstar preview</h1><p>Your local app is running.</p><button>Continue</button></body></html>'
const url = `data:text/html;charset=utf-8,${encodeURIComponent(page)}`

const meta = {
  title: 'Workbench/PreviewView',
  component: PreviewView,
  args: { url, className: 'h-[500px] w-full max-w-[840px] overflow-hidden rounded-lg border border-border' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PreviewView>

export default meta
type Story = StoryObj<typeof meta>

export const LocalApp: Story = {}
