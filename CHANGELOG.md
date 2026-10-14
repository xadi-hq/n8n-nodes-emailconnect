# Changelog

All notable changes to this project will be documented in this file.

## [1.4.2] - 2026-10-14

### Removed
- The **Webhook Signing Secret (No Longer Used)** field on the EmailConnect API credential, and the activation check that refused while it held a value. 1.4.0 was current for under an hour; set the signing secret on the trigger (Verify Signatures and an EmailConnect Webhook Signing API credential).

## [1.4.1] - 2026-10-14

### Fixed
- **Listening for a test event on an active workflow no longer deletes its alias.** Test and production share one EmailConnect webhook, so *Listen for test event* points it at n8n's test URL. When the session ended, the trigger tore the webhook down, and EmailConnect deleted the production alias with it. The trigger now remembers where the webhook pointed and points it back. A test session that cannot tell hands the webhook to the workflow's production URL rather than deleting anything. Present since 1.3.2.
- **Deactivating a workflow deletes only an alias the trigger created.** An alias that existed before (made by hand, or by another workflow), or one whose origin is unknown because it was registered before this version, is switched off instead of deleted: its settings stay, mail to it is rejected as an inactive alias, and reactivating the workflow switches it back on. Catch-all teardown is unchanged: the previous webhook is restored.

### Changed
- **The webhook signing secret is set per trigger.** Turn on **Verify Signatures** in the EmailConnect Trigger and select an **EmailConnect Webhook Signing API** credential holding the secret, one per trigger, so each webhook can have its own. The **Webhook Signing Secret** field on the EmailConnect API credential (1.4.0) is no longer used. While it still holds a value and Verify Signatures is off, activation refuses with an explanation rather than silently stop verifying: turn on Verify Signatures and select a signing credential holding the secret, then clear the old field (or just clear it to stop verifying).

## [1.4.0] - 2026-10-14

### Added
- **Webhook signature verification.** An optional **Webhook Signing Secret** (`whsec_` + base64) in the EmailConnect API credential makes the EmailConnect Trigger verify the HMAC-SHA256 [Standard Webhooks](https://www.standardwebhooks.com) signature EmailConnect puts on every delivery. Requests with a missing or invalid signature, or a timestamp more than 5 minutes off, are rejected with HTTP 401 — including empty-body requests, which previously started a run with a synthetic test item. Verification runs over the raw request bytes, and any of several space-separated `v1` signatures may match, so a future key-rotation overlap needs no node update. No new runtime dependencies.
- The trigger registers the secret on its webhook at activation, and re-registers it when the secret in the credential changes (only a SHA-256 hash is kept in workflow static data, never the secret). After changing the secret, deactivate and reactivate the workflow.
- Requires an EmailConnect Maker plan or higher; activation fails with an explanatory error otherwise. A secret not in `whsec_` format is rejected at activation, since EmailConnect would sign with a different key.

### Changed
- **Documentation for EmailConnect webhook payload v2** (live on EmailConnect from 9 November 2026). The README's trigger output example now shows the v2 payload: `schemaVersion` and `id`, attachment `status` with `reason`/`reasonDetail` replacing `excluded`/`excludeReason`/`storage`/`uploadType`, the new `inline` flag for images shown in the HTML body (kept as `cid:` links, delivered once), and `spam.symbols` in place of the removed `spam.report`. The node passes the payload through unchanged, so the node itself does not change; workflows that read the removed fields must be updated before that date.
- The **Allow Attachments** description now says that it also covers images embedded in the HTML body: with it off, those images are no longer delivered.

### Unchanged
- Without a secret, the trigger behaves exactly as in 1.3.3. Existing workflows are not re-registered by the upgrade.

## [1.3.3] - 2026-06-12

### Changed
- **Failed webhook lookups during activation now surface in the n8n log.** The trigger's `checkExists` (and its `tryStoredWebhook` helper) previously swallowed webhook-search/lookup failures and silently returned "doesn't exist", which could lead n8n to call `create()` again. Both paths now log a `logger.warn` explaining the fallback. Behaviour is unchanged and safe: `create()` is an idempotent upsert (`POST /api/webhooks/alias`, `firstOrCreate` by alias email), so a transient lookup failure cannot orphan or duplicate webhooks. (Addresses n8n community-node verification feedback.)
- **`loadOptions` dropdown failures are logged instead of silently empty.** The domain, alias, and webhook option loaders still degrade gracefully to an empty list, but now emit a `logger.warn` with the underlying cause so misconfigured credentials or API errors are diagnosable.

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

