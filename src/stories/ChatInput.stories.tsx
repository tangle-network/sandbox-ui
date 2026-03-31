import type { Meta, StoryObj } from '@storybook/react'
import { ChatInput, type PendingFile } from '../chat/chat-input'

const meta: Meta<typeof ChatInput> = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[680px]">
        <Story />
      </div>
    ),
  ],
  args: {
    onSend: (msg, files) => console.log('send', msg, files),
    onCancel: () => console.log('cancel'),
  },
}

export default meta
type Story = StoryObj<typeof ChatInput>

export const Empty: Story = {
  name: 'Empty — ready',
}

export const WithModelSelector: Story = {
  name: 'With model selector',
  args: {
    modelLabel: 'claude-sonnet-4-6',
    onModelClick: () => console.log('model click'),
  },
}

export const WithAttachButtons: Story = {
  name: 'With attach buttons',
  args: {
    onAttach: (files) => console.log('attach', files),
    onAttachFolder: (files) => console.log('attach folder', files),
    modelLabel: 'claude-sonnet-4-6',
    onModelClick: () => console.log('model click'),
  },
}

export const Streaming: Story = {
  name: 'Streaming — stop button active',
  args: {
    isStreaming: true,
    onCancel: () => console.log('cancel'),
    onAttach: (files) => console.log('attach', files),
    modelLabel: 'claude-sonnet-4-6',
  },
}

export const Disabled: Story = {
  name: 'Disabled',
  args: {
    disabled: true,
    onAttach: (files) => console.log('attach', files),
    modelLabel: 'claude-sonnet-4-6',
  },
}

const sampleFiles: PendingFile[] = [
  { id: 'f1', name: 'dataset.csv', size: 204800, type: 'file', status: 'ready' },
  { id: 'f2', name: 'report.pdf', size: 1572864, type: 'file', status: 'uploading' },
]

export const WithFilesAttached: Story = {
  name: 'With file attachments',
  args: {
    onAttach: (files) => console.log('attach', files),
    pendingFiles: sampleFiles,
    onRemoveFile: (id) => console.log('remove', id),
    modelLabel: 'claude-sonnet-4-6',
    onModelClick: () => console.log('model click'),
  },
}

const folderFiles: PendingFile[] = [
  { id: 'd1', name: 'my-project', size: 0, type: 'folder', fileCount: 42, status: 'ready' },
  { id: 'f3', name: 'notes.txt', size: 1024, type: 'file', status: 'ready' },
]

export const WithFolderAttached: Story = {
  name: 'With folder + file',
  args: {
    onAttach: (files) => console.log('attach', files),
    onAttachFolder: (files) => console.log('attach folder', files),
    pendingFiles: folderFiles,
    onRemoveFile: (id) => console.log('remove', id),
    modelLabel: 'claude-sonnet-4-6',
  },
}

export const WithErrorFile: Story = {
  name: 'With error attachment',
  args: {
    onAttach: (files) => console.log('attach', files),
    pendingFiles: [
      { id: 'e1', name: 'too-large.zip', size: 524288000, type: 'file', status: 'error' },
      { id: 'f4', name: 'config.json', size: 2048, type: 'file', status: 'ready' },
    ],
    onRemoveFile: (id) => console.log('remove', id),
  },
}

export const CustomPlaceholder: Story = {
  name: 'Custom placeholder',
  args: {
    placeholder: 'Describe the data transformation you need…',
    onAttach: (files) => console.log('attach', files),
    modelLabel: 'gpt-4o',
  },
}

/** Static drag-over overlay preview */
export const DragOverPreview: Story = {
  name: 'Drag-over overlay (static preview)',
  render: (args) => (
    <div className="w-[680px] px-4 py-3 relative">
      {/* Drag overlay replica */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] border-2 border-dashed border-blue-400 bg-blue-500/8 backdrop-blur-sm pointer-events-none mx-4 my-3">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white">Drop files to add context</p>
          <p className="mt-1 text-xs text-zinc-400">Files will be attached to your next message.</p>
        </div>
      </div>
      {/* Underlying input (blurred) */}
      <ChatInput {...args} onAttach={() => {}} />
    </div>
  ),
  args: {},
}
