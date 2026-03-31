import type { Preview, Decorator } from '@storybook/react'
import '../src/styles/globals.css'

const withSandboxTheme: Decorator = (Story, context) => {
  const theme = context.globals.sandboxTheme ?? 'dark'
  const isLight = theme === 'light'
  document.documentElement.setAttribute('data-sandbox-theme', isLight ? 'vault' : '')

  // Override Storybook backgrounds addon with !important
  let styleEl = document.getElementById('sandbox-theme-bg')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'sandbox-theme-bg'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `body { background: ${isLight ? '#f4f3fb' : 'hsl(248 52% 5%)'} !important; }`

  // Return story wrapped in a themed container so CSS vars cascade correctly
  // Using inline style so it always reads from the current var() value post-theme-switch
  return Story()
}

const preview: Preview = {
  decorators: [withSandboxTheme],
  globalTypes: {
    sandboxTheme: {
      name: 'Theme',
      description: 'Sandbox UI theme',
      defaultValue: 'dark',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        showName: true,
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
