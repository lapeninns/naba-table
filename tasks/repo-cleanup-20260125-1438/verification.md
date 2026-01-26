---
task: repo-cleanup
timestamp_utc: 2026-01-25T14:38:16Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not required (no UI changes).

## Test Outcomes

- [x] Lint (warnings only; no errors)
- [x] Typecheck

### Lint Notes

- `pnpm run lint` completed with 15 existing warnings (no errors).

### Typecheck Notes

- `pnpm run typecheck` completed with no errors after restoring required modules.

## Cleanup Evidence (Unused / Artifacts)

- Legacy components removed after 0-hit searches across repo (basename search excluding file itself):
  - `components/BetterIcon.tsx`, `components/ButtonGradient.tsx`, `components/Testimonial1Small.tsx`,
    `components/TestimonialRating.tsx`, `components/Testimonials11.tsx`, `components/Testimonials3.tsx`,
    `components/TestimonialsAvatars.tsx`, `components/TimeSlider.tsx`, `components/app-sidebar.tsx`.
- Artifact backups removed (no references found):
  - `components/ui/.backup-20251003/*`, `components/ui/calendar-temp.txt`,
    `components/ui/calendar.tsx.removed-20251003-163739`, `src/app/globals.css.minimal-backup`.
- Legacy directories removed after 0-hit path searches:
  - `components/mobile/*` (no `components/mobile/*` or `@/components/mobile/*` imports).
  - `components/reserve/booking-flow/*` (no repo references to `booking-flow` paths).
- Reserve shared modules removed after 0-hit path searches:
  - `reserve/shared/utils/booking.ts` (no `shared/utils/booking` imports).
  - `reserve/shared/ui/Field.tsx` (no `@reserve/shared/ui/Field` or `shared/ui/Field` imports after booking-flow removal).
- Legacy folders removed after 0-hit path searches:
  - `components/atoms/*`, `components/guest-account/*`, `components/invite/*`, `components/profile/*` (no `@/components/<dir>` imports).
  - `components/marketing/*` and `components/owner-marketing/*` (no repo imports outside those folders).
  - `components/layout/*` (only referenced by `src/app/layout.tsx.new`, which was removed).
- Reserve legacy helpers/steps removed after 0-hit path searches:
  - `components/reserve/helpers.ts`, `components/reserve/steps/*` (no repo references).
- Scratch removal:
  - `src/app/layout.tsx.new` (only file with `.new` suffix).
  - `src/components/common/index.ts` (no imports).
- Ops/dashboard cleanup after 0-hit searches:
  - `components/ops/restaurants/RestaurantsClient.tsx`
  - `components/dashboard/BookingsListMobile.tsx`
- Supabase CLI temp cache removed:
  - `supabase/.temp/*` (no repo references; now ignored).
- Additional unused legacy components removed after 0-hit searches:
  - `components/ButtonLead.tsx`, `components/ButtonPopover.tsx`, `components/ButtonSignin.tsx`
  - `components/ButtonSupport.tsx`, `components/Modal.tsx`, `components/Testimonials1.tsx`
  - `components/nav-main.tsx`, `components/nav-projects.tsx`, `components/nav-user.tsx`
  - `components/team-switcher.tsx`, `components/auth/SignInForm.tsx`
  - `components/dashboard/BookingRow.tsx`, `components/dashboard/StatusChip.tsx`
  - `components/ui/breadcrumb.tsx`, `components/ui/skeletons.tsx`
  - `components/ops/restaurants/CreateRestaurantDialog.tsx`
  - `components/ops/restaurants/DeleteRestaurantDialog.tsx`
  - `components/ops/restaurants/EditRestaurantDialog.tsx`
  - `components/ops/restaurants/RestaurantsTable.tsx`
- Legacy owner hooks removed after 0-hit searches:
  - `hooks/owner/useOperatingHours.ts`, `hooks/owner/useRestaurantDetails.ts`
  - `hooks/owner/useRestaurantMemberships.ts`, `hooks/owner/useServicePeriods.ts`
  - `hooks/owner/useTeamInvitations.ts`
- Shared libs removed after 0-hit searches:
  - `libs/api.ts`, `libs/gpt.ts`
  - `lib/api/errors.ts`, `lib/api/list-params.ts`
  - `lib/restaurants/api.ts`, `lib/restaurants/useRestaurants.ts`
  - `lib/utils/relative-time.ts`
- Barrels/utilities removed after 0-hit searches:
  - `types/index.ts`, `src/types/index.ts`, `src/services/index.ts`
  - `src/services/ops/index.ts`, `src/contexts/index.ts`, `src/hooks/use-countdown.ts`
  - `src/utils/index.ts`, `src/utils/shortcuts.ts`
- Styles removed after 0-hit searches:
  - `styles/animations.css`, `styles/base.css`
- Reserve shared wrappers removed after 0-hit searches:
  - `reserve/shared/ui/badge.tsx`, `reserve/shared/ui/separator.tsx`, `reserve/shared/ui/toggle.tsx`
  - `reserve/vitest.config.ts`
- Root scripts/utilities removed after 0-hit searches:
  - `route-scanner.js`
  - `send-all-emails.cjs`, `send-test-email.cjs`, `test-email.mjs`, `test-magic-link.mjs`, `trigger-signin.mjs`
- Unused scripts removed after 0-hit searches:
  - `scripts/backfill-review-emails.ts`, `scripts/check-staging-supabase.ts`
  - `scripts/db-perf-baseline-rpc.ts`, `scripts/db-perf-baseline.ts`, `scripts/db-qa-tests.ts`
  - `scripts/debug-redirects.ts`, `scripts/debug-restaurants.ts`, `scripts/execute-sql.ts`
  - `scripts/find-supabase-region.ts`, `scripts/generate-bookings-safe.ts`, `scripts/production-precheck.ts`
  - `scripts/route-smoke.cjs`, `scripts/run-production-optimization.ts`, `scripts/run-schema-optimization.ts`
  - `scripts/seed-bookings-week-final.ts`, `scripts/seed-bookings-week.ts`, `scripts/test-summary-api.ts`
- Unused server modules removed after 0-hit searches:
  - `server/cache/request-deduplication.ts`
  - `server/capacity/engine/filter.ts`, `server/capacity/engine/lookahead.ts`, `server/capacity/engine/window.ts`, `server/capacity/metrics.ts`
  - `server/jobs/allocations-pruner.ts`, `server/jobs/capacity-holds.ts`, `server/jobs/outbox-worker.ts`, `server/jobs/table-scarcity.ts`
  - `server/ops/strategic-config.ts`, `server/reservations/getReservation.ts`, `server/reservations/index.ts`, `server/test-api.ts`
- Unused src components/hooks removed after 0-hit searches:
  - `src/components/auth/SignInForm.tsx`, `src/components/landing/HomeSections.tsx`
  - `src/components/layouts/AuthLayout.tsx`, `src/components/layouts/AuthNavbar.tsx`, `src/components/layouts/index.ts`
  - `src/components/shared/FeatureCard.tsx`, `src/components/shared/PageHero.tsx`, `src/components/shared/PageSection.tsx`, `src/components/shared/index.ts`
  - `src/components/features/index.ts`, `src/components/features/bookings/index.ts`, `src/components/features/customers/index.ts`
  - `src/components/features/dashboard/index.ts`, `src/components/features/dashboard/RealtimeStatus.tsx`
  - `src/components/features/dashboard/manualHoldHelpers.ts`, `src/components/features/dashboard/manual-assignment/HoldExpirationTimer.tsx`
  - `src/components/features/dashboard/manual-assignment/index.ts`, `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx`
  - `src/components/features/ops-shell/OpsOfflineIndicator.tsx`, `src/components/features/ops-shell/index.ts`
  - `src/components/features/restaurant-settings/index.ts`
  - `src/components/landing/analytics/ExitIntentPopup.tsx`, `src/components/landing/analytics/index.ts`
  - `src/components/features/booking/wizard/StepPrefetchBoundary.tsx`
  - `src/components/features/tables/timeline/TableTimelineClient.tsx`, `src/components/features/tables/timeline/index.ts`
  - `src/hooks/ops/useManualAssignmentContext.ts`, `src/hooks/ops/useOpsBookingService.ts`, `src/hooks/ops/useOpsTodayVIPs.ts`
  - `src/hooks/ops/useRealtimeDiagnostics.ts`
  - `src/components/features/dashboard/manual-assignment/AssignmentToolbar.tsx`
  - `src/components/features/dashboard/manual-assignment/ValidationChecks.tsx`
  - `src/components/features/dashboard/TableFloorPlan.tsx`
  - `src/hooks/ops/useAssignmentContext.ts`
- Remaining unused wizard UI/compliance script removed after 0-hit searches:
  - `reserve/features/reservations/wizard/ui/StepSummary.tsx`
  - `reserve/features/reservations/wizard/ui/types.ts`
  - `scripts/check-agents-compliance.cjs`
- Knip false positives retained (entrypoints or test references):
  - `lighthouserc.js`, `next-sitemap.config.js` (scripted by CI/postbuild)
  - `reserve/main.tsx`, `reserve/app/*`, `reserve/pages/*`, `reserve/.storybook/*` (Vite/Storybook entrypoints)
  - `src/components/landing/FactoryHomeClient.tsx` (referenced in tests)
  - `src/server/ops/booking-lifecycle/availability.ts` (imported by server modules)
- Restored after typecheck usage surfaced:
  - `components/ui/card.tsx`
  - `reserve/shared/schedule/availability.ts`

## Artifacts

- `tasks/repo-cleanup-20260125-1438/artifacts/knip-report.json`
- `tasks/repo-cleanup-20260125-1438/artifacts/knip-reference-scan.json`
- `tasks/repo-cleanup-20260125-1438/artifacts/knip-report-20260126-0109.json`
- `tasks/repo-cleanup-20260125-1438/artifacts/knip-report-20260126-0115.json`

## Known Issues

- None.

## Sign-off

- [ ] Engineering
- [ ] QA
