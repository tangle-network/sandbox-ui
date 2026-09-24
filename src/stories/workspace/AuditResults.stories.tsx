import type { Meta, StoryObj } from '@storybook/react'
import { AuditResults } from '../../workspace/audit-results'

const forms = [
  { formId: 'checkout', formName: 'Checkout form', found: true, passed: 2, failed: 1, checks: [
    { label: 'Email field present', expected: 'email', actual: 'email', passed: true },
    { label: 'Submit button enabled', expected: 'enabled', actual: 'enabled', passed: true },
    { label: 'Error message visible', expected: 'visible', actual: 'hidden', passed: false, fieldPath: 'checkout.error' },
  ] },
  { formId: 'login', formName: 'Sign in form', found: true, passed: 1, failed: 0, checks: [{ label: 'Password input protected', expected: 'password', actual: 'password', passed: true }] },
]

const meta = {
  title: 'Workspace/AuditResults',
  component: AuditResults,
  args: { forms, overallScore: 75, className: 'w-full max-w-[540px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AuditResults>

export default meta
type Story = StoryObj<typeof meta>

export const FailedCheckExpanded: Story = {}
export const AllPassed: Story = { args: { forms: [forms[1]], overallScore: 100 } }
