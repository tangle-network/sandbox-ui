import type { Meta, StoryObj } from '@storybook/react'
import { CodeBlock, InlineCode } from '../primitives/code-block'

const meta: Meta<typeof CodeBlock> = {
  title: 'Primitives/CodeBlock',
  component: CodeBlock,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof CodeBlock>

const sandboxClientCode = `import { SandboxClient } from '@tangle/sandbox-sdk'

const client = new SandboxClient({
  apiKey: process.env.TANGLE_API_KEY,
  region: 'us-east-1',
})

const session = await client.sessions.create({
  image: 'node:20-alpine',
  resources: { cpu: 2, memoryMb: 512 },
  timeout: 300,
})

const result = await session.exec('node -e "console.log(process.version)"')
console.log(result.stdout) // v20.11.0

await session.terminate()`

const hookCode = `import { useState, useCallback } from 'react'

type Status = 'idle' | 'running' | 'success' | 'error'

export function useSandboxSession(sessionId: string) {
  const [status, setStatus] = useState<Status>('idle')
  const [output, setOutput] = useState<string[]>([])

  const exec = useCallback(async (command: string) => {
    setStatus('running')
    try {
      const res = await fetch(\`/api/sessions/\${sessionId}/exec\`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      setOutput((prev) => [...prev, data.stdout])
      setStatus('success')
    } catch (err) {
      setStatus('error')
    }
  }, [sessionId])

  return { status, output, exec }
}`

export const Default: Story = {
  args: {
    code: sandboxClientCode,
    language: 'typescript',
  },
}

export const WithLineNumbers: Story = {
  name: 'With Line Numbers',
  args: {
    code: sandboxClientCode,
    language: 'typescript',
    showLineNumbers: true,
  },
}

export const ShortSnippet: Story = {
  name: 'Short Snippet',
  args: {
    code: `const session = await client.sessions.create({ image: 'node:20' })`,
    language: 'typescript',
    showLineNumbers: false,
  },
}

export const HookExample: Story = {
  name: 'Hook Example',
  args: {
    code: hookCode,
    language: 'typescript',
    showLineNumbers: true,
  },
}

export const NoCopyButton: Story = {
  name: 'No Copy Button',
  args: {
    code: `$ curl -X POST https://api.tangle.network/v1/sessions \\\n  -H "Authorization: Bearer $TANGLE_API_KEY" \\\n  -d '{"image": "node:20-alpine"}'`,
    showLineNumbers: false,
  },
}

export const InlineCodeExample: Story = {
  name: 'Inline Code',
  render: () => (
    <div className="space-y-3 text-sm text-foreground max-w-prose">
      <p>
        Use <InlineCode>client.sessions.create()</InlineCode> to provision a new sandbox
        session. Pass <InlineCode>resources.memoryMb</InlineCode> to set memory limits.
      </p>
      <p>
        The <InlineCode>exec()</InlineCode> method returns a{' '}
        <InlineCode>Promise{'<ExecResult>'}</InlineCode> with{' '}
        <InlineCode>stdout</InlineCode>, <InlineCode>stderr</InlineCode>, and{' '}
        <InlineCode>exitCode</InlineCode>.
      </p>
    </div>
  ),
}
