import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { VideoPreview } from '../../assets/preview/video-preview'
import { brand, video } from './fixtures'

function RenderableVideo() {
  const [rendering, setRendering] = useState(false)
  return <div style={{ width: 'min(320px, calc(100vw - 32px))' }}><VideoPreview content={video} brand={brand} isRendering={rendering} onRenderRequest={() => setRendering(true)} /></div>
}

const meta = {
  title: 'Assets/VideoPreview',
  component: VideoPreview,
  args: { content: video, brand },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof VideoPreview>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyToRender: Story = { render: () => <RenderableVideo /> }
export const Rendering: Story = { args: { isRendering: true }, render: (args) => <div style={{ width: 'min(320px, calc(100vw - 32px))' }}><VideoPreview {...args} onRenderRequest={() => {}} /></div> }
