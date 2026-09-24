import { useLayoutEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import TerminalView from '../../terminal/terminal-view'

class DemoSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = DemoSocket.CONNECTING
  binaryType: BinaryType = 'arraybuffer'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor() {
    window.setTimeout(() => {
      if (this.readyState !== DemoSocket.CONNECTING) return
      this.readyState = DemoSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 20)
  }

  send(raw: string) {
    const frame = JSON.parse(raw) as { type: string; data?: string }
    if (frame.type === 'init') {
      window.setTimeout(() => {
        if (this.readyState !== DemoSocket.OPEN) return
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'ready' }) }))
        this.onmessage?.(new MessageEvent('message', { data: '$ pnpm test\r\n  ✓ 48 tests passed\r\n$ ' }))
      }, 20)
    }
    if (frame.type === 'input' && frame.data) {
      this.onmessage?.(new MessageEvent('message', { data: frame.data }))
    }
  }

  close() {
    this.readyState = DemoSocket.CLOSED
    window.setTimeout(() => this.onclose?.(new CloseEvent('close')), 0)
  }
}

function LocalTerminal() {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const original = window.WebSocket
    window.WebSocket = DemoSocket as unknown as typeof WebSocket
    setReady(true)
    return () => { window.WebSocket = original }
  }, [])
  return <div className="h-[460px] w-full max-w-[800px] overflow-hidden rounded-lg border border-border bg-black">{ready && <TerminalView apiUrl="https://storybook-terminal.invalid" token="storybook-demo" connectionId="storybook-terminal" isActive />}</div>
}

const meta = {
  title: 'Terminal/TerminalView',
  component: TerminalView,
  args: { apiUrl: 'https://storybook-terminal.invalid', token: 'storybook-demo' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TerminalView>

export default meta
type Story = StoryObj<typeof meta>

export const ConnectedPty: Story = { render: () => <LocalTerminal /> }
