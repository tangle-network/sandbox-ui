import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import {
  TerminalCursor,
  TerminalDisplay,
  TerminalInput,
  TerminalLine,
} from '../primitives/terminal-display'

const meta: Meta<typeof TerminalDisplay> = {
  title: 'Primitives/TerminalDisplay',
  component: TerminalDisplay,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof TerminalDisplay>

export const Default: Story = {
  name: 'Default',
  render: () => (
    <TerminalDisplay title="bash — sess_01j9x8k2m" className="w-[640px]">
      <TerminalLine type="command">npm install</TerminalLine>
      <TerminalLine type="output">
        {'added 312 packages, and audited 313 packages in 4s'}
      </TerminalLine>
      <TerminalLine type="output">{'found 0 vulnerabilities'}</TerminalLine>
      <TerminalLine type="command">npm run build</TerminalLine>
      <TerminalLine type="output">
        {'\n> sandbox-app@1.0.0 build\n> tsc && vite build'}
      </TerminalLine>
      <TerminalLine type="success">
        {'✓ built in 2.14s'}
      </TerminalLine>
      <TerminalLine type="command">
        node dist/index.js<TerminalCursor />
      </TerminalLine>
    </TerminalDisplay>
  ),
}

export const SandboxVariant: Story = {
  name: 'Sandbox Variant',
  render: () => (
    <TerminalDisplay
      variant="sandbox"
      title="agent — sess_01j9x8k2m"
      className="w-[640px]"
    >
      <TerminalLine type="info" timestamp="14:02:11">
        Session initialized · node:20-alpine · us-east-1
      </TerminalLine>
      <TerminalLine type="command">
        git clone https://github.com/acme/api-service.git
      </TerminalLine>
      <TerminalLine type="output">
        {'Cloning into \'api-service\'...\nremote: Enumerating objects: 1847, done.'}
      </TerminalLine>
      <TerminalLine type="output">
        {'Receiving objects: 100% (1847/1847), 2.31 MiB | 14.2 MiB/s, done.'}
      </TerminalLine>
      <TerminalLine type="command">cd api-service && npm ci</TerminalLine>
      <TerminalLine type="output">
        {'added 421 packages in 6s'}
      </TerminalLine>
      <TerminalLine type="command">npm test -- --reporter=dot</TerminalLine>
      <TerminalLine type="output">
        {'............................................'}
      </TerminalLine>
      <TerminalLine type="success">
        {'✓ 44 tests passed (2.8s)'}
      </TerminalLine>
      <TerminalLine type="thinking">
        Analyzing test coverage...
      </TerminalLine>
    </TerminalDisplay>
  ),
}

export const WithErrors: Story = {
  name: 'With Errors',
  render: () => (
    <TerminalDisplay title="bash — sess_01j9x7r9" className="w-[640px]">
      <TerminalLine type="command">python main.py</TerminalLine>
      <TerminalLine type="output">Loading model weights...</TerminalLine>
      <TerminalLine type="error">
        {'Traceback (most recent call last):\n  File "main.py", line 12, in <module>\n    model = load_checkpoint(args.ckpt)'}
      </TerminalLine>
      <TerminalLine type="error">
        {'FileNotFoundError: [Errno 2] No such file or directory: \'model.pt\''}
      </TerminalLine>
      <TerminalLine type="warning">
        Checkpoint not found. Run download_weights.sh first.
      </TerminalLine>
      <TerminalLine type="command">
        ./download_weights.sh<TerminalCursor />
      </TerminalLine>
    </TerminalDisplay>
  ),
}

export const AgentSession: Story = {
  name: 'Agent Session',
  render: () => (
    <TerminalDisplay
      variant="sandbox"
      title="Claude — task execution"
      className="w-[640px]"
      maxHeight="320px"
    >
      <TerminalLine type="info" timestamp="14:49:58">
        Task: Write and run unit tests for auth module
      </TerminalLine>
      <TerminalLine type="thinking">Reading src/auth/jwt.ts...</TerminalLine>
      <TerminalLine type="output">Found 4 exported functions to test</TerminalLine>
      <TerminalLine type="command">
        {'cat > src/auth/__tests__/jwt.test.ts << \'EOF\''}
      </TerminalLine>
      <TerminalLine type="output">
        {'Writing 6 test cases for: signToken, verifyToken, refreshToken, revokeToken'}
      </TerminalLine>
      <TerminalLine type="command">npx vitest run src/auth/__tests__/jwt.test.ts</TerminalLine>
      <TerminalLine type="output">
        {'✓ signToken returns a valid JWT (12ms)\n✓ verifyToken accepts valid tokens (3ms)\n✓ verifyToken rejects expired tokens (2ms)\n✓ refreshToken issues new token (8ms)\n✗ revokeToken marks token invalid (5ms)'}
      </TerminalLine>
      <TerminalLine type="error">
        AssertionError: Expected token to be revoked but found status: "active"
      </TerminalLine>
      <TerminalLine type="thinking">
        Investigating revocation logic...
      </TerminalLine>
      <TerminalLine type="output">
        Found bug: redis.del() call missing await. Patching...
      </TerminalLine>
      <TerminalLine type="command">npx vitest run src/auth/__tests__/jwt.test.ts</TerminalLine>
      <TerminalLine type="success">
        {'✓ 6 tests passed (31ms)'}
      </TerminalLine>
      <TerminalLine type="info">Task complete. Patch written to src/auth/jwt.ts:L84.</TerminalLine>
    </TerminalDisplay>
  ),
}

export const NoHeader: Story = {
  name: 'No Header',
  render: () => (
    <TerminalDisplay showHeader={false} className="w-[480px]">
      <TerminalLine type="command">ls -la /workspace</TerminalLine>
      <TerminalLine type="output">
        {'total 48\ndrwxr-xr-x 8 node node 4096 Mar 30 14:02 .\ndrwxr-xr-x 3 root root 4096 Mar 30 14:00 ..\n-rw-r--r-- 1 node node  842 Mar 30 14:01 package.json\ndrwxr-xr-x 4 node node 4096 Mar 30 14:02 src'}
      </TerminalLine>
      <TerminalLine type="command">
        {'cat package.json | jq \'.scripts\''}
      </TerminalLine>
      <TerminalLine type="output">
        {'{\n  "build": "tsc && vite build",\n  "test": "vitest",\n  "dev": "vite"\n}'}
      </TerminalLine>
    </TerminalDisplay>
  ),
}

export const WithInput: Story = {
  name: 'With Input',
  render: () => {
    const [lines, setLines] = useState<{ type: 'info' | 'command' | 'output' | 'error' | 'success' | 'warning' | 'thinking'; text: string }[]>([
      { type: 'info', text: 'Session ready · node:20-alpine' },
    ])

    return (
      <div className="flex flex-col gap-2 w-[560px]">
        <TerminalDisplay title="interactive shell" maxHeight="240px">
          {lines.map((l, i) => (
            <TerminalLine key={i} type={l.type}>
              {l.text}
            </TerminalLine>
          ))}
        </TerminalDisplay>
        <TerminalInput
          placeholder="Enter a command..."
          onSubmit={(cmd) => {
            setLines((prev) => [
              ...prev,
              { type: 'command', text: cmd },
              { type: 'output', text: `[${cmd}] executed` },
            ])
          }}
        />
      </div>
    )
  },
}
