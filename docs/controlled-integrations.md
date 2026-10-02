# Controlled integration settings

`@tangle-network/sandbox-ui/integrations` exports `IntegrationsCatalog`,
`IntegrationConnectionDetail`, `ApiKeyConnectDialog` and
`OAuthConnectionParameterDialog`. The dialog `Modal` names are aliases of the same
bindings, not alternative implementations. All display contracts are exported
from this entry and declared in `src/integrations/types.ts`.

## Ownership and adoption

These are rendering components. The application remains responsible for identity,
authorization, supported capabilities, loading display records, safe local
navigation destinations, confirmation, credential submission, validation, grants,
policy decisions, persistence and request cancellation. Do not pass secrets into
catalog/detail display records or error messages. No Hub SDK is imported by the
new views. No host, endpoint, provider policy default or credential store is added.

New consumers supply an ordered `rows` array and controlled query, category and
account selection. A provider row retains its entire `connections` array. Set
`selectedConnectionId` to null until a user has selected an account (or an explicit
saved/route selection has been validated). Missing/stale selections do not fall
back to another account. Account option labels include the ID so identical display
names remain distinguishable. `kind: "app"` entries instead receive installed-count
display data and a local `to` destination; they do not acquire connection actions.

An absent capability or callback omits the corresponding action. Omit
`onRequestIntegration` when the application does not support requests; there is no
placeholder request action. The callback receives the trimmed search term.
`catalogRowActive` is available to applications that want Platform's active-first
ordering; the controlled renderer deliberately does not override supplied order.

For details, pass `detailsByConnectionId` rather than one unkeyed policy response.
Only the explicitly selected ID's result is displayed. Each permission row receives
its effective decision, available decision options, risk label, source label and
reset capability. A null/unrecognized decision displays “Not available”; the view
does not turn a write into Ask or a read into Allow. Groups and collapsed disclosures
are supplied by the owner, without a duplicate policy engine.

API-key and OAuth-parameter values are controlled by the parent. The package keeps
only presentation state (such as reveal/hide), not key values. The parent should
clear transient values/errors on close and target changes, associate outstanding
requests with their original target, and ignore late outcomes after cancellation.
Cancel and Escape remain usable during a busy request. `onSubmit` is an intent;
the owner supplies `busy`/`error`, performs its own request, and closes on success.
Provider-specific metadata controls may be passed as children. Their validation
belongs to the application, which supplies `canSubmit`; the generic required-field
check is not a replacement for server validation.

## Minimal catalog composition

```tsx
import { useState } from "react";
import { IntegrationsCatalog, type IntegrationsProviderRow } from
  "@tangle-network/sandbox-ui/integrations";

function Catalog({ rows, connect, disconnect }: {
  rows: IntegrationsProviderRow[];
  connect: (providerId: string) => void;
  disconnect: (connectionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  return <IntegrationsCatalog
    rows={rows.map(row => ({ ...row, selectedConnectionId: selected[row.providerId] ?? null }))}
    query={query} onQueryChange={setQuery}
    onSelectConnection={(providerId, id) => setSelected(current => ({ ...current, [providerId]: id }))}
    onConnect={row => connect(row.providerId)}
    onDisconnect={connection => disconnect(connection.id)}
  />;
}
```

The callbacks above are application ports, not network implementations. Do not mount
a second provider grid beside the component. Consumers loading styles continue using
the package's existing stylesheet exports; there is no new theme or primitive system.

## Compatibility

`IntegrationsPanel` remains the existing consumer API, including featured IDs,
normalized ranking, alphabetic order, search, callback argument shapes,
`getManageHref` precedence/new-window links, account context and custom actions,
connect failure feedback and cancellable disconnect confirmation. It adapts to the
same catalog renderer in compact tile mode. No second grid implementation remains.
A sole unambiguous account retains the legacy direct-action behavior; multiple
accounts require selection. After an explicit selection disappears, actions do not
silently retarget the remaining account. The old connection-index overwrite is gone.
`useIntegrations` and its endpoint behavior are unchanged for unmigrated consumers.

## Verified source references

Adapted presentation from `tangle-network/agent-dev-container`, default branch
`develop`, inspected before implementation:

| Path under `products/platform/web/src/client/` | Observed source blob |
| --- | --- |
| `components/IntegrationsCatalog.tsx` | `834cf72be0ca64e1977879311ca868f4d19dc30e` |
| `pages/IntegrationPermissions.tsx` | `ef426536a42c2c384fe8bed748298f98438eb6e0` |
| `components/ApiKeyConnectModal.tsx` | `61798f31906ea482f9fc43e3d6d4935d874d9e4c` |
| `components/OAuthConnectionParameterModal.tsx` | `21485f6aa2780d956197a9b6fddaa00fb8462392` |

The layout, provider/app distinction, account details, permission rows/disclosures,
and labelled dialog fields are adapted. Platform hooks, route construction, Hub
schemas, policy calculation, Cloudbeds/PriceLabs rules and manual modal traps are
not transplanted. Dialogs use the maintained shared primitive. Logos retain the
existing `ProviderIcon` resolver.

## Validation surfaces

The repository's existing `pnpm test` collects
`src/integrations/settings-views.test.tsx` alongside the unchanged panel and hook
contracts. `pnpm test:package` builds named integration imports and type contracts
inside the existing clean tarball consumer, including its optional-peer omission
runs. The existing `pnpm typecheck`, `pnpm build`, `pnpm build-storybook` and
`pnpm test:visual` remain the validation commands; no alternate test runner is added.

`Integrations/Settings` contains catalog/detail light and dark stories, loading,
empty/error states, controlled multi-account selection and dialog fixtures.
`tests/visual/integration-settings.spec.mjs` checks responsive geometry, exact account
callbacks, focus trapping and restoration, and attaches rendered catalog/detail
screenshots when executed. A source fixture or screenshot definition is not an
execution result; consult the PR's run evidence for which checks actually ran.

This change exposes library components only. It does not migrate Platform or other
applications, validate production OAuth, prove live policy persistence, or claim
application rollout.
