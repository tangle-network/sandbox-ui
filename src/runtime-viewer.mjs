// Charts owns these stylesheets; the viewer injects them itself so the package's styles.css never carries a copy.
import waterfallCss from '@tangle-network/charts/react/flow-waterfall.css?inline'
import graphCss from '@tangle-network/charts/react/agent-graph.css?inline'
import liveCss from '@tangle-network/charts/react/live.css?inline'
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveRun } from '../dist/run/live.js'

const element = document.getElementById('agent-workspace')
if (element) {
  document.head.append(Object.assign(document.createElement('style'), { textContent: [waterfallCss, graphCss, liveCss].join('\n') }))
  const theme = element.dataset.theme === 'light' ? 'light' : element.dataset.theme === 'dark' ? 'dark' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
  createRoot(element).render(createElement(StrictMode, null, createElement(LiveRun, { api: element.dataset.api ?? '/api/top' })))
}
