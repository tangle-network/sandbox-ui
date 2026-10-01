import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Extend the maintained, isolated tarball consumer rather than source-aliasing it. */
export function writeIntegrationsContract({ root, consumerDir }) {
  appendFileSync(join(consumerDir, 'src/main.js'), `
import {
  IntegrationsCatalog, IntegrationConnectionDetail, ApiKeyConnectDialog,
  OAuthConnectionParameterDialog, ApiKeyConnectModal, OAuthConnectionParameterModal,
  IntegrationsPanel, useIntegrations, catalogRowActive,
} from '@tangle-network/sandbox-ui/integrations';
document.documentElement.dataset.integrationExports = Object.keys({
  IntegrationsCatalog, IntegrationConnectionDetail, ApiKeyConnectDialog,
  OAuthConnectionParameterDialog, ApiKeyConnectModal, OAuthConnectionParameterModal,
  IntegrationsPanel, useIntegrations, catalogRowActive,
}).join(',');
if (ApiKeyConnectDialog !== ApiKeyConnectModal || OAuthConnectionParameterDialog !== OAuthConnectionParameterModal) {
  throw new Error('Integration modal aliases must share their dialog bindings');
}
`);
  const contract = join(consumerDir, 'src/integrations-contract.ts');
  writeFileSync(contract, `
import type {
  IntegrationsCatalogProps, IntegrationConnectionDetailProps, ApiKeyConnectDialogProps,
  OAuthConnectionParameterDialogProps, IntegrationsPanelProps, IntegrationPermissionDisplay,
  IntegrationDisplayConnection,
} from '@tangle-network/sandbox-ui/integrations';
const connection = { id: 'account/two', statusLabel: 'Connected', capabilities: {} } satisfies IntegrationDisplayConnection;
export const catalog = {
  rows: [{ kind: 'provider', providerId: 'slack', title: 'Slack', connections: [connection], selectedConnectionId: null, canConnect: false }],
  query: '', onQueryChange(_query) {}, onSelectConnection(_providerId, _connectionId) {},
} satisfies IntegrationsCatalogProps;
export const permission = {
  actionPath: 'messages.send', title: 'Send', riskLabel: 'Write', decision: null,
  decisionOptions: [], sourceLabel: 'Unresolved',
} satisfies IntegrationPermissionDisplay;
export const detail = {
  provider: { providerId: 'slack', title: 'Slack' }, connections: [connection], selectedConnectionId: null,
  onSelectConnection(_id) {}, detailsByConnectionId: {},
} satisfies IntegrationConnectionDetailProps;
const dialog = { open: false, onOpenChange(_open: boolean) {}, providerId: 'slack', title: 'Slack', onSubmit() {} };
export const key = { ...dialog, value: '', onValueChange(_value) {} } satisfies ApiKeyConnectDialogProps;
export const oauth = { ...dialog, parameters: [], values: {}, onValueChange(_key, _value) {} } satisfies OAuthConnectionParameterDialogProps;
export const legacy = { catalog: [], connections: [], onConnect(_input) {}, onDisconnect(_id) {} } satisfies IntegrationsPanelProps;
`);
  execFileSync(join(root, 'node_modules/.bin/tsc'), [
    '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022',
    '--module', 'ESNext', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM', contract,
  ], { cwd: consumerDir, stdio: 'inherit' });
}
