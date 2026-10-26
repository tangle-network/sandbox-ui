import type { Meta, StoryObj } from '@storybook/react'
import { CodeSurface } from '../../workbench/syntax'

const code = 'export async function loadSettings() {\n  const response = await fetch("/api/settings")\n  if (!response.ok) throw new Error("Settings unavailable")\n  return response.json()\n}\n'

const meta = {
  title: 'Workbench/CodeSurface',
  component: CodeSurface,
  args: { code, filename: 'settings.ts', className: 'h-80 w-full max-w-[650px] rounded-lg border border-border bg-surface-container' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeSurface>

export default meta
type Story = StoryObj<typeof meta>

export const TypeScript: Story = {}
export const Rust: Story = { args: { filename: 'src/lib.rs', code: 'use std::collections::HashMap;\n\n/// Counts each word in `text`.\npub fn word_counts(text: &str) -> HashMap<&str, usize> {\n    let mut counts = HashMap::new();\n    for word in text.split_whitespace() {\n        *counts.entry(word).or_insert(0) += 1;\n    }\n    counts\n}\n' } }
export const Toml: Story = { args: { filename: 'Cargo.toml', code: '[package]\nname = "magnetar"\nversion = "0.4.0"\nedition = "2021"\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\ntokio = { version = "1", features = ["full"] }\n' } }
export const PlainText: Story = { args: { filename: 'README.txt', code: 'Start the sandbox, then open port 3000.\nRestart the process after changing environment variables.', showLineNumbers: false } }
