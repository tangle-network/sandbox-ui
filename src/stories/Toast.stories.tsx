import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { Toast } from '../primitives/toast'
import { ToastContainer, ToastProvider, useToast } from '../primitives/toast'

const meta: Meta = {
  title: 'Primitives/Toast',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

// Static display of all variants side by side (no auto-dismiss)
export const AllVariants: Story = {
  name: 'All Variants',
  render: () => {
    const [toasts, setToasts] = useState<Toast[]>([
      {
        id: '1',
        variant: 'success',
        title: 'Session started',
        description: 'sess_01j9x8k2m is running in us-east-1.',
      },
      {
        id: '2',
        variant: 'error',
        title: 'Session failed to start',
        description: 'Container exited with code 1. Check image pull logs.',
      },
      {
        id: '3',
        variant: 'warning',
        title: 'Session nearing timeout',
        description: 'sess_01j9x7r9 will auto-terminate in 5 minutes.',
      },
      {
        id: '4',
        variant: 'info',
        title: 'Snapshot created',
        description: 'snap_01j9xa1b2 saved successfully.',
      },
      {
        id: '5',
        variant: 'default',
        title: 'Copied to clipboard',
      },
    ])

    return (
      <div className="flex flex-col gap-2 w-96">
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        {toasts.map((t) => (
          // Render inline for story visibility (not fixed positioned)
          <div
            key={t.id}
            className="pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border p-4 shadow-lg"
            style={{
              borderColor:
                t.variant === 'success'
                  ? 'rgb(34 197 94 / 0.2)'
                  : t.variant === 'error'
                    ? 'rgb(239 68 68 / 0.2)'
                    : t.variant === 'warning'
                      ? 'rgb(234 179 8 / 0.2)'
                      : t.variant === 'info'
                        ? 'rgb(59 130 246 / 0.2)'
                        : undefined,
              background:
                t.variant === 'success'
                  ? 'rgb(34 197 94 / 0.1)'
                  : t.variant === 'error'
                    ? 'rgb(239 68 68 / 0.1)'
                    : t.variant === 'warning'
                      ? 'rgb(234 179 8 / 0.1)'
                      : t.variant === 'info'
                        ? 'rgb(59 130 246 / 0.1)'
                        : undefined,
            }}
          >
            <div>
              <p
                className="font-medium text-sm"
                style={{
                  color:
                    t.variant === 'success'
                      ? 'rgb(74 222 128)'
                      : t.variant === 'error'
                        ? 'rgb(248 113 113)'
                        : t.variant === 'warning'
                          ? 'rgb(250 204 21)'
                          : t.variant === 'info'
                            ? 'rgb(96 165 250)'
                            : undefined,
                }}
              >
                {t.title}
              </p>
              {t.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  },
}

function ToastDemo() {
  const { success, error, warning, info, toast } = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => success('Session started', 'sess_01j9x8k2m is running in us-east-1.')}
        className="rounded-md bg-green-600/20 border border-green-500/30 px-3 py-2 text-sm text-green-400 hover:bg-green-600/30"
      >
        Success toast
      </button>
      <button
        onClick={() => error('Session failed', 'Container exited with code 1.')}
        className="rounded-md bg-red-600/20 border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-600/30"
      >
        Error toast
      </button>
      <button
        onClick={() => warning('Session nearing timeout', 'Auto-terminate in 5 minutes.')}
        className="rounded-md bg-yellow-600/20 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-600/30"
      >
        Warning toast
      </button>
      <button
        onClick={() => info('Snapshot saved', 'snap_01j9xa1b2 created successfully.')}
        className="rounded-md bg-blue-600/20 border border-blue-500/30 px-3 py-2 text-sm text-blue-400 hover:bg-blue-600/30"
      >
        Info toast
      </button>
      <button
        onClick={() => toast({ title: 'Copied to clipboard' })}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
      >
        Default toast
      </button>
    </div>
  )
}

export const Interactive: Story = {
  name: 'Interactive (with Provider)',
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
}
