import type {
  AssetSpec,
  AssetVariant,
  BrandTokens,
  CopyContent,
  EmailContent,
  ImageContent,
  VideoContent,
} from '../../assets/types'

export const brand: BrandTokens = {
  businessName: 'Northstar Studio',
  primaryColor: '#303f88',
  accentColor: '#f9c85d',
  textColor: '#ffffff',
  fontFamily: 'Inter, sans-serif',
  voice: 'Clear, warm, and practical',
}

export const email: EmailContent = {
  subject: 'Your next project starts here',
  preheader: 'A focused workspace for the work ahead.',
  sections: [
    { type: 'hero', headline: 'Make room for the next idea', subheadline: 'One place to plan, make, and ship.', ctaLabel: 'Explore the studio', ctaUrl: '#studio' },
    { type: 'body', text: 'Bring your team and their work together. Keep the details close while you move from idea to launch.' },
    { type: 'feature', headline: 'Built for the whole team', description: 'Share drafts, review changes, and keep decisions visible.' },
    { type: 'testimonial', quote: 'We spend less time finding the latest draft and more time improving it.', author: 'Maya Chen', role: 'Creative lead' },
    { type: 'cta', label: 'See the workspace', url: '#workspace', subtext: 'Start with a free project.' },
  ],
}

export const image: ImageContent = {
  slides: [
    {
      background: { type: 'gradient', from: '#172554', to: '#6366f1' },
      layers: [
        { type: 'shape', shape: 'circle', x: 64, y: 10, width: 28, height: 28, fill: '#f9c85d', opacity: 0.9 },
        { type: 'text', text: 'Make space for better work.', x: 10, y: 42, width: 80, fontSize: 34, fontWeight: 'bold' },
        { type: 'text', text: 'Northstar Studio', x: 10, y: 83, width: 70, fontSize: 15 },
      ],
    },
    {
      background: { type: 'gradient', from: '#312e81', to: '#0f172a' },
      layers: [
        { type: 'text', text: 'From idea to launch.', x: 10, y: 40, width: 80, fontSize: 38, fontWeight: 'bold' },
        { type: 'shape', shape: 'rounded-rect', x: 10, y: 78, width: 52, height: 9, fill: '#f9c85d' },
      ],
    },
  ],
}

export const video: VideoContent = {
  durationSeconds: 15,
  scenes: [
    { type: 'text-animation', durationSeconds: 5, headline: 'Ideas need room to grow', animation: 'slide-up' },
    { type: 'countdown', durationSeconds: 3, from: 3, label: 'Launch' },
    { type: 'text-animation', durationSeconds: 7, headline: 'Meet Northstar Studio', animation: 'fade' },
  ],
  captions: [{ startSeconds: 0, endSeconds: 5, text: 'Ideas need room to grow' }],
}

export const caption: CopyContent = {
  headline: 'A workspace for what comes next',
  body: 'Bring your ideas, drafts, and decisions together. Build with your team in one focused place.',
  hashtags: ['BuildTogether', 'NorthstarStudio'],
  platform: 'instagram',
}

const timestamps = { createdAt: '2026-09-12T09:00:00Z', updatedAt: '2026-09-23T16:30:00Z' }

export const emailSpec: AssetSpec<'email'> = {
  id: 'launch-email', workspaceId: 'northstar', format: 'email', brand, content: email,
  status: 'pending_review', ...timestamps,
}

export const imageSpec: AssetSpec<'image:carousel'> = {
  id: 'launch-carousel', workspaceId: 'northstar', format: 'image:carousel', brand, content: image,
  status: 'pending_review', ...timestamps,
}

export const videoSpec: AssetSpec<'video:reel'> = {
  id: 'launch-reel', workspaceId: 'northstar', format: 'video:reel', brand, content: video,
  status: 'draft', ...timestamps,
}

export const captionSpec: AssetSpec<'copy:caption'> = {
  id: 'launch-caption', workspaceId: 'northstar', format: 'copy:caption', brand, content: caption,
  status: 'approved', ...timestamps,
}

export const variants: AssetVariant[] = [
  { id: 'a', parentId: 'launch-caption', label: 'Direct', spec: captionSpec, editLog: [] },
  { id: 'b', parentId: 'launch-caption', label: 'Warm', spec: { ...captionSpec, id: 'launch-caption-b', content: { ...caption, headline: 'Better work starts together', body: 'A calmer way to move your next idea forward with your team.' } }, editLog: [{ assetId: 'launch-caption-b', action: 'edited', editedFields: ['headline', 'body'], userId: 'maya', timestamp: timestamps.updatedAt }] },
]
