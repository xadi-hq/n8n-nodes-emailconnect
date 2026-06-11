# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2026-06-11

### Fixed
- **Test-session teardown no longer breaks a just-published workflow.** n8n deletes the test webhook registration even after publishing, and test + production share one EmailConnect webhook/alias (`firstOrCreate` by email). The trigger's `delete()` now probes ownership first: if the stored webhook's URL no longer matches this registration, it was superseded and teardown is skipped, preserving the live production registration.
- **Webhook name/description survive the test→production URL switch.** Activation runs without the test session's static data, so the re-upsert used to rename user-named webhooks to the generated `n8n trigger (...)` fallback. Precedence is now node parameter → static data → the webhook's current values → generated.
- **Webhook "Update" keeps the webhook verified.** The regular node's webhook update (`PUT /api/webhooks/:id`) now sends the `X-EmailConnect-Source` trusted-source header; without it the backend resets `verified` on any non-test URL change.

### Changed
- Teardown prefers a single atomic `POST /api/webhooks/alias/teardown` call (re-points/cascades aliases and deletes the webhook in one transaction, with `expectedUrl` as a CAS guard), falling back to the legacy multi-call sequence on older backends.
- Dropped the deprecated `autoVerify` body flag from the webhook/alias upsert — the backend ignores it; the `X-EmailConnect-Source` header is the sole auto-verification mechanism.

## [1.3.1] - 2026-06-10

### Fixed
- **Send `X-EmailConnect-Source: n8n-node` on the webhook/alias upsert.** The backend auto-verifies webhooks created/updated by trusted integrations based on this header; relying solely on the `autoVerify` body flag broke against deployed backends (500 on first Execute step, leaving an orphan unverified webhook and no alias).

## [1.3.0] - 2026-06-02

### Fixed
- **Trigger dropped incoming emails.** Removed the client-side `domainId`/`aliasId` filter that rejected payloads when the server-resolved IDs differed from the stored ones (e.g. the "Test webhook" feature, cross-domain rebinds). Delivery is already scoped to the alias/domain server-side, so the filter was redundant and only ever discarded valid emails.
- **Webhook now re-verifies on a test↔production URL switch.** On a URL change the node re-asserts verification through `POST /api/webhooks/alias` (`autoVerify`), instead of the dead `PUT` + `slice(-5)` verify/complete flow (the standalone verify endpoint expects a server-generated token the node can't know, so it could never succeed). This removes the need to verify manually after activating a workflow.

### Changed
- The trigger now emits the **raw EmailConnect payload** as received (`message.*`, `envelope.*`, `security.*`, plus top-level `domainId`/`aliasId`) instead of a lossy flattened object whose top-level `sender`/`subject`/`status` were always `undefined`. Update expressions to read `message.*` / `envelope.*`.
- Removed the non-functional **"Events"** selector — the delivered payload carries no event-type field, so it could only ever drop every email when set to anything other than the default.

### Performance
- Activation is slightly faster: the domain and alias lookups now run concurrently, and the alias lookup is skipped entirely outside catch-all mode.

### Removed
- Stale planning docs (`docs/TODO.md`, `docs/api-differences.md`, `docs/nodes/`) and the unused bundled `emailconnect-openapi.json`; pruned outdated `claudedocs/`.

## [1.2.1] - 2026-06-02

### Fixed
- Pass authentication through `httpRequestWithAuthentication` instead of injecting the `X-API-KEY` header manually (required by the `@n8n/eslint-plugin-community-nodes` verification ruleset).
- Remove the `overrides` field from `package.json` (not permitted in community node packages).

## [1.2.0] - 2026-06-02

### Fixed
- **Alias create/update**: aliases now route to a webhook (`webhookId`) per the EmailConnect API. The previous `destinationEmail` field was never a valid API field and alias create was missing the required `webhookId`, so both operations failed.
- **Domain "Update Configuration"**: send `allowAttachments` / `includeEnvelope` as top-level fields (the API field is `includeEnvelope`, not `includeEnvelopeData`, and they are not nested under `configuration`).

### Added
- Alias create/update expose optional payload-shaping fields: `active`, `allowAttachments`, `includeEnvelope`, `includeHtml`, `includeText`.
- "Return All" / "Limit" controls on all "Get Many" operations.

### Changed
- Removed all `console.*` logging from the nodes; non-fatal webhook-lifecycle warnings now use n8n's logger.
- Re-enabled the previously-disabled `eslint-plugin-n8n-nodes-base` verification rules and fixed the violations they surfaced.
- Replaced the seven overlapping GitHub Actions workflows with a lean `ci.yml` (lint + build + test on Node 20/22) and a `release.yml` that publishes to npm with provenance via OIDC trusted publishing.
- Updated dev dependencies to current in-range releases; pinned a patched `form-data` via `overrides` (`npm audit` is clean).

### Removed
- The non-functional `destinationEmail` alias parameter (superseded by `aliasWebhookId`).
- Outdated tests that targeted removed behaviour or required a live backend, and a committed API key.

