import type { Meta, StoryObj } from "@storybook/react"
import { EmbeddedAppView } from "../../workbench/embedded-app-view"

const url = new URL("./preview-fixture.html", import.meta.url).href
const meta: Meta<typeof EmbeddedAppView> = {
  title: "Workbench/EmbeddedAppView",
  component: EmbeddedAppView,
  args: {
    app: { id: "reporting", name: "Reporting", previewUrl: url, status: "ready" },
    className: "h-[500px] w-full max-w-[900px] overflow-hidden rounded-lg border border-border",
  },
  parameters: { layout: "padded" },
}
export default meta
type Story = StoryObj<typeof EmbeddedAppView>

export const Ready: Story = {}
export const Starting: Story = {
  args: { app: { id: "reporting", name: "Reporting", status: "starting" } },
}
export const Unavailable: Story = {
  args: {
    app: { id: "reporting", name: "Reporting", status: "unavailable", statusMessage: "The preview service could not connect." },
    onRetry: () => {},
  },
}
export const InvalidAddress: Story = {
  args: {
    app: { id: "reporting", name: "Reporting", previewUrl: "javascript:alert(1)", status: "ready" },
    onRetry: () => {},
  },
}
