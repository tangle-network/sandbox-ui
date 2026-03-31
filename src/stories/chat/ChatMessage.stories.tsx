import type { Meta, StoryObj } from '@storybook/react'
import { ChatMessage } from '../../chat/chat-message'
import { ToolCallStep } from '../../run/tool-call-step'

const meta: Meta<typeof ChatMessage> = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[var(--bg-root)] p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ChatMessage>

const ts = (offsetMinutes = 0) =>
  new Date(Date.now() - offsetMinutes * 60 * 1000)

export const UserMessage: Story = {
  args: {
    role: 'user',
    content: 'How do I implement a binary search tree in TypeScript?',
    timestamp: ts(3),
  },
}

export const AssistantSimple: Story = {
  args: {
    role: 'assistant',
    content:
      'A binary search tree (BST) is a node-based data structure where each node has at most two children, and all left descendants are less than the node, all right descendants are greater.',
    timestamp: ts(2),
  },
}

export const AssistantWithCode: Story = {
  args: {
    role: 'assistant',
    content: `Here's a clean BST implementation in TypeScript:

\`\`\`typescript
interface TreeNode<T> {
  value: T
  left: TreeNode<T> | null
  right: TreeNode<T> | null
}

class BinarySearchTree<T> {
  private root: TreeNode<T> | null = null

  insert(value: T): void {
    this.root = this.insertNode(this.root, value)
  }

  private insertNode(node: TreeNode<T> | null, value: T): TreeNode<T> {
    if (!node) return { value, left: null, right: null }
    if (value < node.value) node.left = this.insertNode(node.left, value)
    else if (value > node.value) node.right = this.insertNode(node.right, value)
    return node
  }

  contains(value: T): boolean {
    let current = this.root
    while (current) {
      if (value === current.value) return true
      current = value < current.value ? current.left : current.right
    }
    return false
  }

  inOrder(): T[] {
    const result: T[] = []
    const traverse = (node: TreeNode<T> | null) => {
      if (!node) return
      traverse(node.left)
      result.push(node.value)
      traverse(node.right)
    }
    traverse(this.root)
    return result
  }
}
\`\`\`

**Key properties:**
- \`insert\` — O(log n) average, O(n) worst case
- \`contains\` — O(log n) average, O(n) worst case
- \`inOrder\` — O(n) always, yields sorted output

For a balanced variant, consider AVL or Red-Black trees.`,
    timestamp: ts(2),
  },
}

export const AssistantStreaming: Story = {
  args: {
    role: 'assistant',
    content: `I'll analyze the performance bottleneck in your \`fetchData\` hook. The issue is that \`useState(true)\` initializes loading as true before React even checks the cache`,
    isStreaming: true,
    timestamp: ts(0),
  },
}

export const AssistantWithToolCalls: Story = {
  args: {
    role: 'assistant',
    content: 'Let me read the current implementation first.',
    toolCalls: (
      <div className="mt-3 space-y-2">
        <ToolCallStep
          type="read"
          label="Read src/hooks/useFetchData.ts"
          status="success"
          output={`export function useFetchData<T>(url: string) {\n  const [data, setData] = useState<T | null>(null)\n  const [loading, setLoading] = useState(true)\n  // ...`}
          duration={48}
        />
        <ToolCallStep
          type="grep"
          label="Search for cache references"
          status="success"
          output="No cache layer found. Data fetched on every mount."
          duration={12}
        />
      </div>
    ),
    timestamp: ts(1),
  },
}

export const AssistantMarkdownRich: Story = {
  args: {
    role: 'assistant',
    content: `## Rate Limiter Design

The **sliding window** algorithm is the right choice here. Here's why:

| Algorithm | Burst Handling | Redis Ops | Accuracy |
|-----------|---------------|-----------|---------- |
| Fixed window | Poor | 1 | Low |
| Token bucket | Good | 2-3 | Medium |
| **Sliding window** | **Excellent** | **2** | **High** |

### Implementation

\`\`\`typescript
import Redis from 'ioredis'

export async function rateLimitCheck(
  redis: Redis,
  userId: string,
  limit = 100,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const key = \`rl:\${userId}\`
  const windowStart = now - windowMs

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, '-inf', windowStart)
  pipeline.zadd(key, now, \`\${now}-\${Math.random()}\`)
  pipeline.zcard(key)
  pipeline.pexpire(key, windowMs)

  try {
    const results = await pipeline.exec()
    const count = (results?.[2]?.[1] as number) ?? 0
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    // Fail open on Redis errors
    return { allowed: true, remaining: limit }
  }
}
\`\`\`

> **Note:** The \`zremrangebyscore\` + \`zadd\` pair is atomic per key, keeping overhead to ~0.3ms p99 on a local Redis instance.`,
    timestamp: ts(1),
  },
}

export const SystemMessage: Story = {
  args: {
    role: 'system',
    content: 'Session started. Connected to agent runtime v2.4.1.',
    timestamp: ts(5),
  },
}

export const Conversation: Story = {
  render: () => (
    <div className="space-y-4">
      <ChatMessage
        role="user"
        content="Can you help me debug why my React query cache isn't working?"
        timestamp={ts(5)}
      />
      <ChatMessage
        role="assistant"
        content="Sure — let me look at your query setup. What version of TanStack Query are you on, and how are you configuring the `QueryClient`?"
        timestamp={ts(4)}
      />
      <ChatMessage
        role="user"
        content="v5.28. I'm using the defaults — just `new QueryClient()` with no options."
        timestamp={ts(3)}
      />
      <ChatMessage
        role="assistant"
        content={`The default \`staleTime\` in v5 is \`0\`, which means every component mount triggers a background refetch even if data is in cache. That explains the flicker.

Set a non-zero \`staleTime\`:

\`\`\`typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
})
\`\`\`

With this, cached data is considered fresh for 60 seconds and no refetch occurs on mount.`}
        timestamp={ts(2)}
      />
    </div>
  ),
}
