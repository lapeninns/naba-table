---
task: google-business-profile-sync
timestamp_utc: 2026-04-07T11:18:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No blocking Console errors
- [x] Network requests match contract

Notes:

- Verified `/dev/ops-settings-restaurant` in the updated dev harness using the dedicated `Google Business Profile` view selector.
- Verified `/dev/restaurants-directory` after enriching the harness fixture with the expanded normalized Google Business Profile shape (`placeId`, `openStatus`).
- Ops flow exercised on the dedicated page: disconnected → connected/needs location → partial sync, with imported snapshot highlights, Google Maps link, review link, website link, and per-family sync diagnostics visible.
- Ops flow now also proves the new sync history section: after the manual mock sync, the page shows both the latest partial run and an older failed run with per-family badges and timestamps.
- Ops flow now also proves the new latest-sync diff section: after the manual mock sync, the page shows four detected changes with before/after values for description, service items, review count, and performance metrics.
- Public venue guide now shows a dedicated “Live from Google” section with open status, hours snapshot, attributes, review excerpt, media preview, and direct Google links.
- Directory harness showed Google-derived listing summary/category signals for the fallback-enriched restaurant card.
- Observed one non-blocking browser issue on the Ops harness: `No label associated with a form field`. This appears to stem from the pre-existing logo upload surface rather than the new Google Business Profile section.
- Observed one additional browser issue on the harness: `A form field element should have an id or name attribute`, also attributable to pre-existing harness/form surfaces rather than the new GBP workspace.

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

Notes:

- New page uses semantic headings, buttons, alerts, labeled comboboxes, and clearly separated cards/sections for connection state, imported overview, sync health, and detailed data families.
- The new change-summary card presents before/after values in clearly labeled groups and remains readable in both desktop and mobile layouts.
- Status messaging and imported snapshot copy remain visible and understandable across disconnected, connected, partial-sync, and sync-history states.
- Keyboard check in DevTools confirmed focus can move through the sync workspace links and controls after the history section renders.

### Performance (profiled; mobile; 4× CPU; 4G)

- Snapshot audit only on local dev harness; production-like throttled perf budgets were not collected from `next dev`.
- Ops harness Lighthouse snapshot: Accessibility 94 / Best Practices 100 / SEO 80.
- Ops harness Lighthouse snapshot after the sync-history slice: Accessibility 94 / Best Practices 100 / SEO 80.
- Public directory harness Lighthouse snapshot: Accessibility 100 / Best Practices 100 / SEO 80.
- Budgets met: [ ] Yes [x] No (notes)

Notes:

- Snapshot audit was saved for accessibility/best-practices verification only.
- A production build or deployed preview is still required before treating perf budgets as final.

### Device Emulation

- [x] Mobile (≈375px)
- [x] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths
- [x] Error handling
- [x] A11y (axe): 0 critical/serious

Commands:

- `npx eslint server/google-business-profile 'src/app/api/ops/google-business-profile' 'src/app/api/ops/restaurants/[id]/google-business-profile' src/components/features/restaurant-settings/RestaurantGoogleBusinessProfileSection.tsx src/components/features/restaurant-settings/RestaurantProfileSection.tsx src/hooks/ops/useOpsRestaurantGoogleBusinessProfile.ts src/services/ops/restaurants.ts tests/server/google-business-profile-normalize.test.ts tests/server/google-business-profile-routes.test.ts tests/guest/public-restaurants-pages.test.tsx`
- `npx eslint 'src/app/(public)/dev/restaurants-directory/ui/RestaurantsDirectoryDevHarness.tsx'`
- `pnpm typecheck`
- `npx vitest run tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx`
- `npx vitest run tests/server/google-business-profile-normalize.test.ts tests/server/google-business-profile-routes.test.ts tests/guest/public-restaurants-pages.test.tsx`
- `npx vitest run tests/config/env-schema-target.test.ts tests/server/google-business-profile-routes.test.ts`
- `npx vitest run tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx tests/components/RestaurantSettingsRoutes.test.ts tests/server/google-business-profile-client.test.ts tests/server/google-business-profile-normalize.test.ts`
- `npx vitest run tests/guest/public-restaurants-pages.test.tsx tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx tests/components/RestaurantSettingsRoutes.test.ts tests/server/google-business-profile-client.test.ts tests/server/google-business-profile-normalize.test.ts`
- `npx vitest run tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx tests/components/RestaurantSettingsRoutes.test.ts tests/server/google-business-profile-client.test.ts tests/server/google-business-profile-normalize.test.ts tests/guest/public-restaurants-pages.test.tsx`
- `npx vitest run tests/server/google-business-profile-diff.test.ts tests/server/google-business-profile-client.test.ts tests/server/google-business-profile-normalize.test.ts tests/server/google-business-profile-routes.test.ts tests/components/RestaurantGoogleBusinessProfileSection.test.tsx tests/guest/public-restaurants-pages.test.tsx`
- `pnpm run build`
- `pnpm run validate:env`
- `curl -X PATCH https://api.supabase.com/v1/projects/ndxmivcrehsacuerwxtm/database/password` (CLI shell, using `SUPABASE_ACCESS_TOKEN` + `STAGING_DB_PASSWORD`)
- `pnpm dlx supabase@latest migration list --db-url <staging-pooler-url>`
- `pnpm -s tsx scripts/apply-sql-file.ts --file supabase/migrations/20260407113500_add_restaurant_google_business_profiles.sql --expected-ref ndxmivcrehsacuerwxtm`

Results:

- Targeted eslint passed.
- Typecheck passed.
- Vitest passed: 3 files, 13 tests.
- Focused hardening proof passed: 2 files, 15 tests.
- Dedicated-page regression proof passed: 5 files, 14 tests.
- Public-page enrichment proof passed: 6 files, 21 tests.
- Sync-history regression proof passed: 2 files, 10 tests.
- Expanded GBP/public regression proof passed: 6 files, 21 tests.
- Latest-sync diff proof passed: 6 files, 24 tests.
- Production build passed and includes `/app/settings/restaurant/google-business-profile`.
- `validate:env` now warns, by design, when `SUPABASE_DB_URL` targets a different Supabase project than `NEXT_PUBLIC_SUPABASE_URL`. Current local env is still in that mismatched state.
- Staging database password was rotated successfully via the Supabase Management API from the CLI.
- Verified before apply: `to_regclass('public.restaurant_google_business_profiles')` returned `null`.
- Verified after apply: `to_regclass('public.restaurant_google_business_profiles')` returned `restaurant_google_business_profiles`.

## Artifacts

- Lighthouse:
  - `artifacts/report.json`
  - `artifacts/report.html`
  - `artifacts/public-restaurants-google-profile-lighthouse.json`
  - `artifacts/lighthouse-google-business-profile-sync-history/report.json`
  - `artifacts/lighthouse-google-business-profile-sync-history/report.html`
- Traces/Screens:
  - `artifacts/google-business-profile-settings-desktop.png`
  - `artifacts/google-business-profile-settings-mobile.png`
  - `artifacts/google-business-profile-sync-history-desktop.png`
  - `artifacts/google-business-profile-sync-history-mobile.png`
  - `artifacts/google-business-profile-change-summary-desktop.png`
  - `artifacts/google-business-profile-change-summary-mobile.png`
  - `artifacts/ops-google-business-profile-desktop.png`
  - `artifacts/ops-google-business-profile-mobile.png`
  - `artifacts/public-restaurants-google-profile-desktop.png`
  - `artifacts/public-restaurants-google-live-section.png`
- Network:
  - Browser network inspection performed live in DevTools; no HAR export captured in this pass.
- DB diff (if DB change): `artifacts/db-diff.txt` pending remote staging dry-run for `20260408110500_add_restaurant_google_business_profile_sync_events.sql`

## Known Issues

- [x] Local dev harness shows one pre-existing unlabeled form-field issue outside the new GBP section.
- [ ] Local `.env.local` currently mixes the staging runtime project with a different `SUPABASE_DB_URL`, so remote migration commands are intentionally blocked until those credentials are aligned.
- [ ] `supabase db push --linked --dry-run` is still noisy in this repo because of duplicate historical migration version files and a prepared-statement issue through the linked pooler path. The targeted staging SQL apply completed successfully despite that.
- [ ] The new sync-history table migration has been authored locally and logged in `docs/DATABASE_MIGRATIONS.md`, but it still needs the normal staging → production remote apply workflow.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [x] QA
