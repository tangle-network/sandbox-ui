import type { Meta, StoryObj } from '@storybook/react'
import { UserMessage } from '../../chat/user-message'
import type { SessionMessage } from '../../types/message'
import type { SessionPart } from '../../types/parts'

const meta: Meta<typeof UserMessage> = {
  title: 'Chat/UserMessage',
  component: UserMessage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[var(--bg-root)] p-8">
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof UserMessage>

const makeMessage = (id: string): SessionMessage => ({
  id,
  role: 'user',
  time: { created: Date.now() },
})

const textPart = (text: string): SessionPart => ({ type: 'text', text })

export const Simple: Story = {
  args: {
    message: makeMessage('msg-1'),
    parts: [textPart('How do I implement a binary search tree in TypeScript?')],
  },
}

export const Multiline: Story = {
  args: {
    message: makeMessage('msg-2'),
    parts: [
      textPart(
        `I have a React component that fetches data on mount but the loading state flickers briefly even when data is cached.\n\nHere's what I'm doing:\n\n\`\`\`tsx\nconst [data, setData] = useState(null)\nconst [loading, setLoading] = useState(true)\n\nuseEffect(() => {\n  fetchData().then(setData).finally(() => setLoading(false))\n}, [])\n\`\`\`\n\nWhat's the cleanest fix?`,
      ),
    ],
  },
}

export const ShortQuestion: Story = {
  args: {
    message: makeMessage('msg-3'),
    parts: [textPart('What is the time complexity of quicksort in the worst case?')],
  },
}

export const WithMarkdown: Story = {
  args: {
    message: makeMessage('msg-4'),
    parts: [
      textPart(
        `Can you refactor this so it uses **async/await** instead of promise chains?\n\nAlso make sure:\n- Error handling is explicit\n- The return type is \`Promise<Result<T, Error>>\`\n- No unhandled rejections`,
      ),
    ],
  },
}

export const LongMessage: Story = {
  args: {
    message: makeMessage('msg-5'),
    parts: [
      textPart(
        `I'm building a distributed rate limiter that needs to work across multiple Node.js instances behind a load balancer. The requirements are:\n\n1. Max 100 requests per minute per user\n2. Sliding window (not fixed)\n3. Redis as the shared store\n4. Must handle Redis failure gracefully (fail open)\n5. Sub-millisecond p99 overhead\n\nI've seen the token bucket and leaky bucket algorithms but I'm not sure which is better here. Can you walk me through the implementation in TypeScript using ioredis, and explain the trade-offs?`,
      ),
    ],
  },
}

export const WithActions: Story = {
  args: {
    message: makeMessage('msg-6'),
    parts: [textPart('Write a SQL query to find the top 5 customers by revenue this quarter.')],
    actions: (
      <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
        Edit
      </button>
    ),
  },
}
