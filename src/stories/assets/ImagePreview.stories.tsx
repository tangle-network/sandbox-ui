import type { Meta, StoryObj } from '@storybook/react'
import { ImagePreview } from '../../assets/preview/image-preview'
import { brand, image } from './fixtures'

const meta = {
  title: 'Assets/ImagePreview',
  component: ImagePreview,
  args: { content: image, brand, format: 'feed' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ImagePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Carousel: Story = { render: (args) => <div style={{ width: 'min(420px, calc(100vw - 32px))' }}><ImagePreview {...args} format="carousel" /></div> }
export const StoryFormat: Story = { args: { format: 'story' }, render: (args) => <div style={{ width: 'min(320px, calc(100vw - 32px))' }}><ImagePreview {...args} /></div> }
