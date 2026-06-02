# Changelog

All notable changes to this project will be documented in this file.

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

