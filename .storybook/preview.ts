import type { Preview, Decorator } from '@storybook/react'
import '../src/styles/globals.css'

const withSandboxTheme: Decorator = (Story, context) => {
  const theme = context.globals.sandboxTheme ?? 'dark'
  const isLight = theme === 'light'
  document.documentElement.setAttribute('data-sandbox-ui', 'true')
  document.documentElement.setAttribute('data-sandbox-theme', isLight ? 'vault' : '')

  let styleEl = document.getElementById('sandbox-theme-bg')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'sandbox-theme-bg'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `body { background: ${isLight ? '#f4f3fb' : 'hsl(248 52% 5%)'} !important; }`

  return Story()
}

const preview: Preview = {
  decorators: [withSandboxTheme],
  initialGlobals: {
    sandboxTheme: 'dark',
  },
  globalTypes: {
    sandboxTheme: {
      description: 'Sandbox UI theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'dark', title: 'Dark (Operator)' },
          { value: 'light', title: 'Light (Vault)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
  },
}

export default preview
