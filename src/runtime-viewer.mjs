import '@tangle-network/charts/react/flow-waterfall.css'
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveRun } from '../dist/run/live.js'

const element = document.getElementById('agent-workspace')
if (element) {
  const theme = element.dataset.theme === 'light' ? 'light' : element.dataset.theme === 'dark' ? 'dark' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
  createRoot(element).render(createElement(StrictMode, null, createElement(LiveRun, { api: element.dataset.api ?? '/api/top' })))
}
