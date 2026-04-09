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

We will let Ops connect a restaurant to its Google Business Profile from a dedicated restaurant settings workspace, sync the broadest relevant read-only Google Business Profile data into Nab a Table with resilient per-family error handling, and use that normalized data to enrich the restaurant landing page.

## Success Criteria

- [ ] Ops can start a Google connect flow from `/settings/restaurant/google-business-profile`.
- [ ] A successful callback stores a linked Google account/location plus encrypted tokens server-side.
- [ ] Ops can fetch and refresh Google profile data for the linked restaurant.
- [ ] Ops can review recent manual sync attempts, including partial/failure diagnostics, on the dedicated GBP settings page.
- [ ] Ops can see what changed between the latest sync and the previous synced snapshot without manually diffing raw Google data.
- [ ] Public restaurant landing pages can read normalized imported Google data when present.
- [ ] Targeted tests cover the server sync/normalization flow, redirect targets, and the new settings page/view states.

## Architecture & Components

- `restaurants` table:
  - continue storing canonical editable restaurant profile fields already used throughout the app.
- New `restaurant_google_business_profiles` table:
  - one row per Nabatable restaurant
  - connection metadata, encrypted OAuth tokens, selected GBP account/location IDs, sync timestamps/status, raw payload snapshot, normalized profile snapshot
- New `restaurant_google_business_profile_sync_events` table:
  - append-only operational log of manual sync attempts
  - run timestamps, selected location context, overall status, top-level error, and per-family diagnostics
- Server integration modules:
  - Google OAuth helpers
  - Google Business Profile API client
  - sync orchestrator that hydrates all supported resource families, records per-family results, and normalizes them
- Ops settings UI:
  - add a dedicated `google-business-profile` settings view and page route
  - remove the Google Business Profile card from `RestaurantProfileSection`
  - add a page-sized Google Business Profile workspace component with connection controls, imported-data sections, and family-level sync diagnostics
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
Response: connection status, selected location summary, last sync metadata, normalized snapshot, per-family sync health, recent sync history

Endpoint: `POST /api/ops/restaurants/[id]/google-business-profile/sync`
Request: optional selected account/location identifiers when first linking
Response: updated connection state + normalized snapshot + per-family sync health + recent sync history

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
- Partially synced:
  - show successful imports plus non-blocking warnings for failed optional families
- Sync history:
  - show recent runs with timestamp, location context, overall status, and per-family outcomes
- Change detection:
  - show the latest-sync diff summary against the previous synced snapshot
  - highlight the most important listing changes with before/after values
- Syncing:
  - pending state with disabled actions
- Synced:
  - show high-signal imported fields and last sync timestamp
- Dedicated workspace:
  - separate sections for connection, imported overview, location details, attributes, reviews, media, performance, and sync diagnostics
- Error:
  - inline destructive alert with retry and reconnect options

## Edge Cases

- OAuth callback succeeds but location list is empty.
- Token refresh fails after initial connection.
- Google returns partial profile data for the location.
- A new sync succeeds after a previous failure; history should preserve both outcomes while the top-level status reflects only the latest run.
- Restaurant already has manual profile data; imported fields should not break existing landing pages.
- A restaurant reconnects to a different GBP location; previous snapshot should be replaced cleanly.

## Testing Strategy

- Unit:
  - token encryption/decryption helper
  - GBP snapshot normalization
- Integration:
  - route handlers for connect/status/sync with mocked Google responses and updated redirect targets
  - route/status payload coverage for sync history data
  - restaurant settings page/component rendering for disconnected/connected/synced/partial/error states
- E2E / UI proof:
  - Dev harness for Ops restaurant settings Google Business Profile state
  - Chrome DevTools verification for the dedicated settings page and public restaurant page consumption
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
  - none required; sync-event table starts empty and only records new runs
- Rollback plan:
  - disable routes via env
  - retain main connection data if needed for safe rollback
  - drop the sync-event table in a compensating migration if the history feature is fully reverted
