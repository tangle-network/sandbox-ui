import type { Meta, StoryObj } from '@storybook/react'
import geistRegular from '@fontsource/geist/files/geist-latin-400-normal.woff2?inline'
import geistBold from '@fontsource/geist/files/geist-latin-700-normal.woff2?inline'
import { PreviewView } from '../../workbench/preview-view'

const page = `<!doctype html><html><head><style>
  @font-face { font-family: "Preview Geist"; src: url("${geistRegular}") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Preview Geist"; src: url("${geistBold}") format("woff2"); font-weight: 700; }
  body { font: 16px "Preview Geist", sans-serif; padding: 48px; color: #24233d; }
  </style></head><body><h1>Northstar preview</h1><p>Your local app is running.</p><button>Continue</button></body></html>`
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
