import type { Meta, StoryObj } from '@storybook/react'
import { UploadProgress, type UploadFile } from '../primitives/upload-progress'

const meta: Meta<typeof UploadProgress> = {
  title: 'Primitives/UploadProgress',
  component: UploadProgress,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof UploadProgress>

const pending: UploadFile = {
  id: '1',
  name: 'dataset.csv',
  size: 204800,
  status: 'pending',
}

const uploading45: UploadFile = {
  id: '2',
  name: 'report-q4-2024.pdf',
  size: 1572864,
  status: 'uploading',
  progress: 45,
}

const uploading0: UploadFile = {
  id: '3',
  name: 'model-weights.bin',
  size: 52428800,
  status: 'uploading',
  progress: 0,
}

const complete: UploadFile = {
  id: '4',
  name: 'config.json',
  size: 2048,
  status: 'complete',
}

const error: UploadFile = {
  id: '5',
  name: 'too-large.zip',
  size: 524288000,
  status: 'error',
  error: 'File exceeds 500 MB limit',
}

export const Pending: Story = {
  name: 'Pending',
  args: { files: [pending] },
}

export const UploadingStart: Story = {
  name: 'Uploading — 0%',
  args: { files: [uploading0], onRemove: (id) => console.log('remove', id) },
}

export const UploadingMid: Story = {
  name: 'Uploading — 45%',
  args: { files: [uploading45], onRemove: (id) => console.log('remove', id) },
}

export const UploadingAlmostDone: Story = {
  name: 'Uploading — 90%',
  args: {
    files: [{ ...uploading45, progress: 90, name: 'export-final.xlsx' }],
    onRemove: (id) => console.log('remove', id),
  },
}

export const Complete: Story = {
  name: 'Complete',
  args: { files: [complete], onRemove: (id) => console.log('remove', id) },
}

export const Error: Story = {
  name: 'Error with retry',
  args: {
    files: [error],
    onRemove: (id) => console.log('remove', id),
    onRetry: (id) => console.log('retry', id),
  },
}

export const ErrorNoRetry: Story = {
  name: 'Error — no retry handler',
  args: {
    files: [{ ...error, error: 'Network timeout' }],
    onRemove: (id) => console.log('remove', id),
  },
}

export const MixedQueue: Story = {
  name: 'Mixed queue',
  args: {
    files: [complete, uploading45, pending, error],
    onRemove: (id) => console.log('remove', id),
    onRetry: (id) => console.log('retry', id),
  },
}

export const Empty: Story = {
  name: 'Empty (renders nothing)',
  args: { files: [] },
}

export const NoActions: Story = {
  name: 'No remove / retry handlers',
  args: { files: [complete, uploading45, error] },
}
