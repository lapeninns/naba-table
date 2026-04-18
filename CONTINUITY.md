# Continuity Ledger

Last updated: 2026-04-18T15:47:00Z

## Goal (incl. success criteria)

- Review changes on branch `codex/Menu` against merge base `2dbdce280a8ec516d03ac57fd42c063dc953e980` and return only concrete, actionable regressions.
- Implement a first-class Google Business Profile connection flow in the Nabatable ops dashboard.
- Success: a restaurant admin can authorize Google, return safely to Nabatable, and choose which GBP location links to the current restaurant.
- Success: Nabatable stores provider credentials and OAuth state securely without creating a second restaurant business-data model.
- Success: the current restaurant profile/settings surfaces remain intact and working.
- Success: linked GBP business information can be manually synced into Nabatable-owned canonical tables and viewed in the dashboard for the active restaurant.
- Success: GBP-synced canonical business-information fields can carry field-level verification metadata when the additive verification table is available remotely.
- Success: overlapping core Nabatable profile fields show a clear visual match indicator when their current values equal fetched GBP data.
- Success: GBP hour families are normalized against Nabatable core booking structures with explicit matched/drifted/partial semantics instead of being treated as equivalent by assumption.
- Success: core settings pages surface GBP verification badges/actions directly on Profile, Operating Hours, and Service Periods.
- Success: admins can sync drifted core data with GBP from the core pages, using latest-known change timestamps to choose push vs pull.
- Success: mapped core fields and day rows expose the fetched GBP value/window via tooltip triggers so admins can inspect what would be imported before syncing.
- Success: every GBP fetch/import/export action requires password confirmation with the logged-in user's password before execution.
- Success: multi-item GBP sync actions support explicit checkbox selection so admins can sync only the chosen fields/days/rows.
- Success: selected-only GBP sync preserves unselected core/provider rows and validates normalized payloads before execution.

## Constraints/Assumptions

- Follow root `AGENTS.md` plus `src/app`, `src/components`, and `server` nested rules.
- Chrome DevTools proof is required because this task adds a new dashboard UI surface.
- Use the existing canonical business-information schema; do not introduce a parallel GBP business-data model.
- The neighboring GBP project remains useful for payload patterns, but runtime auth cannot depend on it because its stored refresh token is revoked.
- First pass no longer stops at connect/link only; manual pull sync for business information is now in scope and implemented.
- Existing restaurant settings views and profile editing must not regress.
- Remote DB migration application may be unavailable even when the staging app itself works, so the GBP route needs a compatibility path before the new verification table exists in the remote schema cache.

## Key decisions

- Treat dashboard GBP connection as a new task after the canonical schema work.
- Keep `restaurant_external_profiles` as the durable public integration record.
- Add separate support tables for encrypted credentials and short-lived OAuth state instead of overloading the canonical business tables.
- Use a dedicated `Google Business Profile` settings page rather than overloading the current restaurant profile form.
- Follow Google's web-server OAuth flow with offline access and explicit state validation.
- Keep this pass scoped to connect/link/disconnect plus live discovery, not full business-information sync.

## State

- Review task folder created at `tasks/code-review-menu-20260418-1425/`.
- Diff against `main` inspected for GBP sync, menu import, and drink import changes.
- Concrete review findings identified:
  - menu imports treat a groups-only upload as a destructive modifier replacement
  - drink imports do the same for drink modifiers
  - GBP address push reuses stale structured address parts when exporting a changed flat address
- Prior canonical GBP business-information schema task is complete and available for reuse.
- A new task folder has been created at `tasks/gbp-dashboard-connect-20260418-1106/`.
- Research confirms Nabatable currently has no native Google OAuth/token flow, but the env scaffolding already includes GBP credential placeholders.
- Official Google docs confirm the required OAuth scope, offline-access flow, and account/location discovery endpoints.
- The neighboring GBP workspace still demonstrates fetch patterns, but its stored token is revoked and cannot serve as the runtime integration path.
- The dashboard connection flow is now implemented end to end inside Nabatable: env support, additive schema, encrypted credential storage, OAuth state handling, Google callback flow, settings UI, and guarded ops APIs.
- Local verification proves the new settings page renders and the connect button hands off correctly to Google OAuth after the staging migration is present.
- Follow-up debugging proved the Google callback was being blocked by proxy auth on the root host and then mis-returning to the root-host settings path.
- The proxy and callback/connect host handling are now patched, and a full live browser run has completed through Google auth plus in-app location linking for Old Crown Girton.
- Canonical GBP business-information sync is now implemented, including location profile fetch, attribute fetch, snapshot persistence, canonical-table writes, sync-now route handling, and read-only business-information UI on the GBP settings page.
- A live sync against The Old Crown Girton succeeds and the regular Chrome browser now shows About, Contact, Location, Categories, Hours, and More sections populated from canonical Nabatable tables.
- Field-level GBP verification metadata is now implemented in code through `restaurant_field_sync_statuses`, along with DTO and UI support for verified/drifted badges.
- The current staging-backed environment still lacks the new remote table in the schema cache, so the new code includes a migration-tolerant fallback and the live browser proof is limited to no-regression rather than active badge rendering.
- The canonical Restaurant Profile page now computes live field matches against fetched GBP data and shows a `Matches GBP` badge for overlapping fields even before the remote verification table is available.
- A new read-only normalization layer now projects GBP hour families into candidate operating hours and service periods, compares those projections against Nabatable core tables, and explains where booking-hour verification remains partial.
- A new follow-on task folder has been created at `tasks/gbp-core-verification-sync-20260418-1307/` to move verification and sync controls onto the core pages.
- Core-page verification and sync is now implemented for profile, operating hours, and service periods, including bidirectional server paths where GBP supports the mapped data.
- A follow-on task folder has been created at `tasks/gbp-core-comparison-tooltips-20260418-1332/` to expose fetched GBP values/windows directly on the core editors.
- A new task folder has been created at `tasks/gbp-sync-confirmation-hardening-20260418-1342/` for password confirmation, multi-select sync, and normalization hardening.
- GBP sync actions on profile, operating hours, service periods, and the GBP settings page now open a shared password-confirmation dialog before execution.
- Profile sync now sends explicit field selections, while operating-hours and service-period sync now send selection manifests so only the chosen rows/days are imported or exported.
- Server-side GBP sync builders now preserve unselected rows instead of replacing entire sections, which makes partial bidirectional sync safe.
- New server-side password confirmation uses a stateless Supabase password check against the current authenticated user's email before GBP sync executes.
- Focused tests, typecheck, and production build all pass for the confirmation-hardening changes.
- A follow-up compatibility fix now prevents the profile sync route from 500ing on environments where `restaurant_field_sync_statuses` is not yet present in the remote schema cache.
- A follow-up auth fix now prevents password-confirmed GBP actions from logging the active user out by signing out the temporary confirmation session with `scope: 'local'`.
- A cookie-backed session replay against `app.localhost` now confirms the active dashboard session survives a password-confirmed GBP sync request.
- A new follow-on task folder has been created at `tasks/gbp-kitchen-window-split-20260418-1418/` for refining whole-day kitchen-window normalization.
- GBP normalization now infers lunch/dinner from a single unlabeled `Kitchen` window when that window spans `17:00`, keeping server normalization and core-page comparison logic aligned.
- Live Old Crown verification now reports `businessInfo.coreNormalization.servicePeriods.matchStatus = matched` across all 14 normalized windows, including Sunday.

## Done

- Re-read the applicable AGENTS policy and local Nabatable skills.
- Audited the existing restaurant settings shell, ops service architecture, and admin access guard patterns.
- Confirmed there is no existing GBP dashboard route, Google OAuth route, or secure provider-credential storage in Nabatable today.
- Reviewed the neighboring GBP workspace for reusable Google API patterns and confirmed the revoked-token blocker.
- Created the GBP dashboard connect task artifacts with requirements and implementation plan.
- Added runtime env validation for Google Business Profile OAuth credentials and token encryption.
- Added an additive Supabase migration for GBP connection metadata, encrypted credentials, and short-lived OAuth state.
- Implemented the server-side Google Business Profile integration layer for auth URL creation, token exchange, refresh, location discovery, linking, and disconnect.
- Added guarded ops API routes for connect, callback, state fetch, link, and disconnect.
- Added a new `Google Business Profile` restaurant settings page, subnav entry, hooks, and service methods.
- Updated the dev mock restaurant service to support the new GBP settings surface.
- Added focused route tests and passed `pnpm typecheck`.
- Verified the authenticated GBP settings route in Chrome DevTools and captured a screenshot artifact.
- Fixed proxy auth so `/api/ops/google-business-profile/callback` can complete without an existing ops cookie on `localhost`.
- Normalized GBP post-auth return URLs to the app host so successful or error callbacks land back in the dashboard instead of the root domain.
- Verified locally with live browser automation that the restaurant reached `Linked` state against the Old Crown Girton GBP location.
- Added canonical GBP business-information sync logic and snapshot retention under `server/google-business-profile/`.
- Added `POST /api/ops/restaurants/[id]/google-business-profile` sync support and extended the GET payload with canonical `businessInfo`.
- Added the dashboard business-information panel and sync controls on the GBP settings page.
- Synced real Old Crown Girton GBP business information into canonical Nabatable tables and verified it in the user's regular Chrome browser.
- Cleaned up attribute rendering so boolean-style GBP facts no longer render as duplicate label/value pairs.
- Passed focused GBP tests and a full production build after the sync/UI implementation.
- Added `supabase/migrations/20260418121500_add_restaurant_field_sync_statuses.sql` and corresponding generated database types.
- Extended the canonical GBP business-info sync/read model to emit and consume field-level verification metadata.
- Added a compatibility fallback for environments where `restaurant_field_sync_statuses` is not yet applied remotely.
- Verified in regular Chrome that the GBP settings page recovered from the prior 500 and still renders canonical business information for The Old Crown Girton.
- Added live `Matches GBP` badges to the canonical restaurant profile form for name/phone/address/map/review fields when the current Nabatable value equals the fetched GBP value.
- Verified in regular Chrome that The Old Crown Girton currently shows the badge on Contact Phone, Address, Google Review URL, and Google Maps URL.
- Added `server/google-business-profile/core-normalization.ts` to normalize GBP regular/special/more-hours into projected Nabatable operating-hours and service-period shapes.
- Extended the GBP business-info response with `coreNormalization` so the dashboard can compare projected GBP hours against `restaurant_operating_hours` and `restaurant_service_periods`.
- Added a new `Core Alignment` section on the GBP settings page showing operating-hours drift, service-period availability, and booking-hours partial verification status.
- Verified in regular Chrome that Old Crown Girton currently normalizes from GBP `Kitchen` more hours, shows operating-hours drift, service-period unavailability, and booking-hours partial verification.
- Remote migration application is still blocked in this environment by DB connection/auth failures, so live verification badges are not yet active in staging.
- Created task artifacts for core-page verification/sync work covering profile, operating hours, and service periods.
- Added core sync POST handlers on `/details`, `/hours`, and `/service-periods`.
- Added profile/operating-hours/service-periods sync hooks and core-page badges/actions.
- Added latest-change recommendations using core `updatedAt` versus GBP `lastPullAt`/`lastPushAt`.
- Added GBP push support for profile core fields, regular/special operating hours, and kitchen-backed service-period more-hours.
- Passed targeted GBP tests and a full production build after the core-page verification/sync implementation.
- Live Old Crown data verification confirms:
  - core profile is currently aligned and newer than the last GBP pull
  - operating hours are drifted and older than the GBP pull
  - service periods are drifted and older than the GBP pull
- Chrome DevTools MCP browser transport failed during the last UI proof attempt, so final verification used the documented AGENTS fallback path with build/test coverage plus live server-side state inspection.
- A new task folder has been created at `tasks/review-findings-fix-20260418-1437/` for fixing accepted code-review findings from the `codex/Menu` diff.
- The accepted review findings are now fixed in code: paired modifier CSV validation, safe flat-address GBP export rejection, and persisted-timestamp-based implicit sync direction.
- Targeted Vitest suites, `pnpm exec tsc --noEmit --pretty false`, and `pnpm run build` all pass after the fixes.

## Now

- Hand off the implemented fixes for the accepted review findings with verification results.

## Next

- If asked to re-review, re-run `git diff 2dbdce280a8ec516d03ac57fd42c063dc953e980` and inspect any follow-up fixes.
- If requested later, restore safe GBP address push by introducing canonical structured postal-address storage in Nabatable and mapping that directly to `storefrontAddress`.
- If requested later, re-run a visual pass on the core settings pages to confirm the verification warnings still read clearly after the address-export restriction.

## Open questions (UNCONFIRMED if needed)

- None blocking the connection-flow implementation.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/AGENTS.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/CONTINUITY.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/config/env.schema.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/lib/env.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/app/(app)/settings/restaurant/\*\*
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/[id]/\*\*
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/\*\*
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/contexts/ops-services.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/hooks/ops/\*\*
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/services/ops/restaurants.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/\*\*
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/types/supabase.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-dashboard-connect-20260418-1106/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-dashboard-connect-20260418-1106/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-dashboard-connect-20260418-1106/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-dashboard-connect-20260418-1106/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-business-sync-20260418-1150/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-business-sync-20260418-1150/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-business-sync-20260418-1150/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-business-sync-20260418-1150/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-field-verification-20260418-1213/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-field-verification-20260418-1213/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-field-verification-20260418-1213/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/gbp-field-verification-20260418-1213/verification.md
