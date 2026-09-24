import type { Meta, StoryObj } from "@storybook/react"
import { PreviewView } from "../../workbench/preview-view"

const url = new URL("./preview-fixture.html", import.meta.url).href
const meta: Meta<typeof PreviewView> = {
  title: "Workbench/PreviewView",
  component: PreviewView,
  args: { url, className: "h-[500px] w-full max-w-[840px] overflow-hidden rounded-lg border border-border" },
  parameters: { layout: "padded" },
}
export default meta
type Story = StoryObj<typeof PreviewView>

export const LocalApp: Story = {}
export const VerifiedResponse: Story = {
  args: { readiness: { state: "ready", checkedAt: "2026-09-23T12:00:00Z", statusCode: 200 }, access: { state: "authenticated", source: "enforced-policy" } },
}
export const FailedCheck: Story = {
  args: { readiness: { state: "failed", checkedAt: "2026-09-23T12:00:00Z", message: "The application did not respond." }, access: { state: "public", source: "enforced-policy" } },
}
export const UnsafeAddress: Story = { args: { url: "data:text/html,not-an-approved-preview" } }
