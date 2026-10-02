---
"@tangle-network/sandbox-ui": minor
---

Expose controlled integration catalog, account-selectable connection settings, API-key and OAuth-parameter dialogs through `/integrations`. Adapt Platform's presentation using maintained primitives, semantic tokens and ProviderIcon without importing Hub transport, credential persistence, grants or policy defaults.

Keep IntegrationsPanel's callbacks and featured/alphabetic ordering as a compatibility facade over the shared renderer. Preserve every non-revoked account and require explicit selection when multiple accounts exist. Existing useIntegrations is unchanged. This is library availability, not an application rollout.
