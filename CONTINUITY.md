# Continuity Ledger

Last updated: 2026-04-08T10:57:48Z

## Goal (incl. success criteria)

- Add a Google Business Profile integration to restaurant Ops settings so venues can connect their Google profile, sync available GBP data, and enrich the curated public restaurant landing page.
- Success: an Ops user can connect a restaurant to Google Business Profile from a dedicated restaurant settings workspace at `/settings/restaurant/google-business-profile`.
- Success: Nab a Table can fetch and persist the supported GBP data for the linked location.
- Success: public restaurant pages can consume normalized imported GBP data without breaking the existing curated directory flow.
- Success: the GBP workspace shows recent manual sync history with enough detail to troubleshoot partial and failed runs over time.
- Success: the GBP workspace shows the latest-sync diff so Ops can spot listing drift immediately after each sync.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, `src/components/AGENTS.md`, `src/services/ops/AGENTS.md`, and `server/AGENTS.md` rules, including task artifacts and Chrome DevTools verification for UI work.
- Keep the canonical implementation inside the existing restaurant settings flow and restaurant landing-page data pipeline, but move GBP out of the profile form and into its own page.
- Supabase remains remote-only; local code can prepare migrations, but deployment depends on remote apply.
- OAuth credentials and refresh tokens must never be exposed to the client or stored in plaintext.

## Key decisions

- Use a dedicated restaurant-linked Google Business Profile integration record rather than spreading external-token state across the `restaurants` table.
- Store raw Google snapshots plus a normalized projection that can be merged into the existing curated landing-page overlay.
- Use a dedicated restaurant settings page for Google Business Profile so profile editing stays focused while GBP gets a richer Ops workspace.
- Treat Google sync as partially successful when optional API families fail; store per-family health so the UI can explain what succeeded and what did not.
- Add sync history as a separate operational record set rather than storing an unbounded event list on the main GBP connection row.
- Keep sync-history persistence additive: a history-write failure must not break the main GBP sync result.

## State

- The Google Business Profile storage migration has now been applied to the staging runtime project `ndxmivcrehsacuerwxtm` using a CLI-driven SQL apply path.
- The dedicated Google Business Profile settings page is now implemented at `/app/settings/restaurant/google-business-profile`, with the embedded profile-page section removed and per-family partial-sync diagnostics exposed in the UI.
- Public restaurant guides now surface richer GBP data too, including open status, hours, review excerpt, media preview, and direct Google links when present.
- The GBP sync-history slice is now implemented locally on the dedicated settings page, backed by a new append-only migration and surfaced in the dev harness.
- The latest-sync change-summary slice is now implemented locally: the server computes a canonical diff between the previous and newest normalized snapshots, persists it inside the existing GBP snapshot JSON, and the dedicated workspace renders the before/after highlights.
- The main remaining operational cleanup is still to align `.env.local` so the generic `SUPABASE_DB_URL` also points to staging instead of a different project.

## Done

- Reviewed the Nabatable task harness, fullstack delivery, and UI proof skills.
- Audited the canonical restaurant settings route, service, hook, API, and public landing-page enrichment flow.
- Confirmed the repo has no existing external OAuth integration pattern or token encryption helper to reuse.
- Created task artifacts under `tasks/google-business-profile-sync-20260407-1118/`.
- Identified the main integration points:
  - `src/components/features/restaurant-settings/RestaurantProfileSection.tsx`
  - `components/ops/restaurants/RestaurantDetailsForm.tsx`
  - `src/hooks/ops/useOpsRestaurantDetails.ts`
  - `src/services/ops/restaurants.ts`
  - `src/app/api/ops/restaurants/[id]/details/route.ts`
  - `server/restaurants/details.ts`
  - `src/data/restaurant-directory.ts`
- Confirmed the current app environment is staging, not production.
- Added a `validate:env` blocker when `SUPABASE_DB_URL` and `NEXT_PUBLIC_SUPABASE_URL` resolve to different Supabase projects.
- Added a stable Google Business Profile storage-not-ready error so the callback redirect tells us to apply the pending migration instead of collapsing to a generic failure.
- Verified the hardening changes with:
  - `npx vitest run tests/config/env-schema-target.test.ts tests/server/google-business-profile-routes.test.ts`
  - `pnpm typecheck`
- Rotated the staging database password for project `ndxmivcrehsacuerwxtm` through the Supabase Management API from the CLI so the stored staging password matched the remote project again.
- Verified the pending table was absent, applied `supabase/migrations/20260407113500_add_restaurant_google_business_profiles.sql` against staging via `pnpm -s tsx scripts/apply-sql-file.ts`, and confirmed `public.restaurant_google_business_profiles` now exists with the expected columns.
- Moved Google Business Profile into a dedicated restaurant settings page and route, added it to restaurant settings navigation and Ops navigation, and updated OAuth redirect targets to return there instead of the profile page.
- Expanded the Google Business Profile workspace to show disconnected, connected, and partial-sync states with imported overview, detailed family sections, and per-family sync diagnostics.
- Updated dev harness fixtures and public directory harness fixtures for the expanded normalized GBP shape.
- Enriched public restaurant pages with a dedicated “Live from Google” section and stronger GBP-aware fallback copy for directory cards.
- Verified the new dedicated page through focused component/route tests, `pnpm typecheck`, `pnpm run build`, and Chrome DevTools on `/dev/ops-settings-restaurant`.
- Verified the public venue guide enrichment in tests and Chrome DevTools on `/dev/restaurants-directory`.
- Updated the GBP task artifacts to add a sync-history follow-on slice.
- Added `restaurant_google_business_profile_sync_events` as a new local migration plus manual log entry in `docs/DATABASE_MIGRATIONS.md`.
- Extended the GBP server/lib path to read/write recent sync history and made history persistence non-blocking relative to the main sync.
- Verified the sync-history UI in Chrome DevTools on `/dev/ops-settings-restaurant` with new desktop/mobile screenshots and a fresh Lighthouse snapshot.
- Added canonical latest-sync diff computation plus Ops UI rendering for before/after listing changes.
- Verified the new diff card in Chrome DevTools on `/dev/ops-settings-restaurant` after the manual mock sync, with fresh desktop/mobile screenshots saved in the task artifacts.
- Verified the latest diff slice with:
  - `pnpm typecheck`
  - `npx vitest run tests/server/google-business-profile-diff.test.ts tests/server/google-business-profile-client.test.ts tests/server/google-business-profile-normalize.test.ts tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx tests/guest/public-restaurants-pages.test.tsx`

## Now

- Finish the final build pass and share the completed latest-sync diff implementation and verification summary with the user.

## Next

- Add deeper review/media drill-down on the dedicated GBP page so Ops can inspect more imported content without leaving the workspace.
- Apply `20260408110500_add_restaurant_google_business_profile_sync_events.sql` to staging, then production, through the normal remote migration workflow.
- Align `.env.local` so `SUPABASE_DB_URL` points to the same staging project as `NEXT_PUBLIC_SUPABASE_URL`.
- Re-run `pnpm run validate:env` once the generic DB target is corrected.

## Open questions (UNCONFIRMED if needed)

- Which exact GBP endpoint families are enabled for every connected account/location. (UNCONFIRMED runtime capability; partial-sync UI will absorb this)

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/google-business-profile-sync-20260407-1118/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantProfileSection.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantGoogleBusinessProfileSection.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/routes.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components/ops/restaurants/RestaurantDetailsForm.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/hooks/ops/useOpsRestaurantDetails.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/hooks/ops/useOpsRestaurantGoogleBusinessProfile.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/services/ops/restaurants.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/lib/restaurants/google-business-profile.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/google-business-profile/service.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/google-business-profile/store.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/[id]/details/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/google-business-profile/callback/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/details.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/update.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/data/restaurant-directory.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/getRestaurantBySlug.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/dev/ops-settings-restaurant/ui/OpsRestaurantSettingsDevHarness.tsx
