import type { Meta, StoryObj } from "@storybook/react"
import { DiffView } from "../../workbench/diff-view"

const baseline = 'export const endpoint = "https://example.test/old";\n'
const current = `export const endpoint = "https://example.test/${"a-long-unbroken-segment-".repeat(70)}END_OF_LINE";\n`

const meta: Meta<typeof DiffView> = {
  title: "Workbench/DiffReadability",
  component: DiffView,
  args: { filename: "src/client/configuration.ts", baseline, current, showFileHeader: false },
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ height: 560, width: "100%", maxWidth: 960, minWidth: 0 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof DiffView>

export const Wrapped: Story = {}
export const HorizontalScroll: Story = { args: { defaultWrap: false } }
export const Narrow: Story = {
  decorators: [(Story) => <div style={{ width: 320, maxWidth: "100%", height: "100%", minWidth: 0 }}><Story /></div>],
}
export const NoChanges: Story = { args: { current: baseline } }
export const UnbrokenText: Story = {
  args: { filename: "response.txt", baseline: "before\n", current: `${"x".repeat(4096)}END_OF_LINE\n` },
}
