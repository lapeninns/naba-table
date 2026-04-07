---
task: google-business-profile-sync
timestamp_utc: 2026-04-07T11:18:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Google Business Profile Sync

## Objective

We will let Ops connect a restaurant to its Google Business Profile, sync available Google Business Profile data into Nab a Table, and use that normalized data to enrich the restaurant landing page.

## Success Criteria

- [ ] Ops can start a Google connect flow from restaurant profile settings.
- [ ] A successful callback stores a linked Google account/location plus encrypted tokens server-side.
- [ ] Ops can fetch and refresh Google profile data for the linked restaurant.
- [ ] Public restaurant landing pages can read normalized imported Google data when present.
- [ ] Targeted tests cover the server sync/normalization flow and the settings UI states.

## Architecture & Components

- `restaurants` table:
  - continue storing canonical editable restaurant profile fields already used throughout the app.
- New `restaurant_google_business_profiles` table:
  - one row per Nabatable restaurant
  - connection metadata, encrypted OAuth tokens, selected GBP account/location IDs, sync timestamps/status, raw payload snapshot, normalized profile snapshot
- Server integration modules:
  - Google OAuth helpers
  - Google Business Profile API client
  - sync orchestrator that hydrates all supported resource families and normalizes them
- Ops settings UI:
  - extend `RestaurantProfileSection`
  - add a dedicated Google Business Profile card or section inside the canonical profile settings page
- Landing page enrichment:
  - extend directory enrichment to merge normalized Google snapshot fields into curated display data

## Data Flow & API Contracts

Endpoint: `POST /api/ops/restaurants/[id]/google-business-profile/connect`
Request: none
Response: `{ authorizationUrl: string }`

Endpoint: `GET /api/ops/restaurants/[id]/google-business-profile/callback`
Request: Google OAuth callback query params
Response: redirect back to Ops settings with success/error state

Endpoint: `GET /api/ops/restaurants/[id]/google-business-profile`
Response: connection status, selected location summary, last sync metadata, normalized snapshot

Endpoint: `POST /api/ops/restaurants/[id]/google-business-profile/sync`
Request: optional selected account/location identifiers when first linking
Response: updated connection state + normalized snapshot

Errors:

- `{ error, code }` stable API shape
- auth required: `401`
- membership forbidden: `403`
- missing integration config: `400`
- Google sync failure: `502` or `400` depending on failure type

## UI/UX States

- Disconnected:
  - explain what will be imported
  - primary CTA to connect Google Business Profile
- Connected but not synced:
  - show linked account/location summary
  - CTA to import profile data
- Syncing:
  - pending state with disabled actions
- Synced:
  - show high-signal imported fields and last sync timestamp
- Error:
  - inline destructive alert with retry and reconnect options

## Edge Cases

- OAuth callback succeeds but location list is empty.
- Token refresh fails after initial connection.
- Google returns partial profile data for the location.
- Restaurant already has manual profile data; imported fields should not break existing landing pages.
- A restaurant reconnects to a different GBP location; previous snapshot should be replaced cleanly.

## Testing Strategy

- Unit:
  - token encryption/decryption helper
  - GBP snapshot normalization
- Integration:
  - route handlers for connect/status/sync with mocked Google responses
  - restaurant settings section rendering for disconnected/connected/synced/error states
- E2E / UI proof:
  - Dev harness for Ops restaurant settings profile state
  - Chrome DevTools verification for profile settings and public restaurant page consumption
- Accessibility:
  - keyboard flow and semantic alerts/buttons in the new settings section

## Rollout

- Feature flag: none for now; ship behind environment/config readiness because the feature is inert without Google credentials.
- Exposure: restaurants with valid Ops access and configured Google integration env vars.
- Monitoring:
  - server logs for callback/sync errors
  - sync status timestamps stored on integration row
- Kill-switch:
  - remove or unset Google env vars to disable new connect attempts

## DB Change Plan (if applicable)

- Target envs: staging → production
- Backup reference: remote Supabase backup/PITR confirmation required before apply
- Dry-run evidence: to be added to `artifacts/db-diff.txt`
- Backfill strategy:
  - none required; table starts empty
- Rollback plan:
  - disable routes via env
  - retain table data if needed for safe rollback, or drop added table in compensating migration if the feature is fully reverted
