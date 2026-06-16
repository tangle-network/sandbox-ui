import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ProvisioningWizard } from '../../pages/provisioning-wizard'

const meta: Meta<typeof ProvisioningWizard> = {
  title: 'Pages/ProvisioningWizard',
  component: ProvisioningWizard,
  parameters: { layout: 'padded', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof ProvisioningWizard>

const sshKeys = [
  {
    id: 'k1',
    name: 'Laptop',
    keyType: 'ssh-ed25519',
    fingerprint: 'SHA256:xC9F2k…aBc',
  },
  {
    id: 'k2',
    name: 'Desktop',
    keyType: 'ssh-rsa',
    fingerprint: 'SHA256:7Hq3pL…dEf',
  },
]

export const OnePage: Story = {
  name: 'One-page (SSH access)',
  render: () => {
    const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>(['k1'])
    const [inlinePublicKeys, setInlinePublicKeys] = useState('')
    return (
      <ProvisioningWizard
        onSubmit={() => console.log('deploy')}
        onBack={() => console.log('back')}
        sshAccess={{
          keys: sshKeys,
          selectedKeyIds,
          inlinePublicKeys,
          onSelectedKeyIdsChange: setSelectedKeyIds,
          onInlinePublicKeysChange: setInlinePublicKeys,
        }}
      />
    )
  },
}

export const OnePageNoSsh: Story = {
  name: 'One-page (no SSH access)',
  render: () => (
    <ProvisioningWizard
      onSubmit={() => console.log('deploy')}
      onBack={() => console.log('back')}
    />
  ),
}
