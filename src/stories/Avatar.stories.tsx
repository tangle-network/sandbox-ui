import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarImage, AvatarFallback } from '../primitives/avatar'

const meta: Meta<typeof Avatar> = {
  title: 'Primitives/Avatar',
  component: Avatar,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
}

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/broken.png" alt="Broken" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
}

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>AK</AvatarFallback>
    </Avatar>
  ),
}

export const CustomSize: Story = {
  render: () => (
    <Avatar className="h-16 w-16">
      <AvatarFallback className="text-lg">BL</AvatarFallback>
    </Avatar>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Sizes</div>
      <div className="flex items-center gap-4">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">XS</AvatarFallback>
        </Avatar>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">SM</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>MD</AvatarFallback>
        </Avatar>
        <Avatar className="h-14 w-14">
          <AvatarFallback>LG</AvatarFallback>
        </Avatar>
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-xl">XL</AvatarFallback>
        </Avatar>
      </div>
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-2">Team</div>
      <div className="flex items-center gap-3">
        {[
          { initials: 'AK', label: 'Alex Kim' },
          { initials: 'JD', label: 'Jane Doe' },
          { initials: 'MR', label: 'Marco Rossi' },
          { initials: 'SP', label: 'Sara Park' },
        ].map(({ initials, label }) => (
          <div key={initials} className="flex flex-col items-center gap-1">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">{label}</span>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-2">Stacked</div>
      <div className="flex -space-x-2">
        {['AK', 'JD', 'MR', 'SP', '+4'].map((label) => (
          <Avatar key={label} className="border-2 border-background">
            <AvatarFallback className="text-xs">{label}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  ),
}
