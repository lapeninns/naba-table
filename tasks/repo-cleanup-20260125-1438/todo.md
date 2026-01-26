---
task: repo-cleanup
timestamp_utc: 2026-01-25T14:38:16Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm scoped AGENTS.md for affected directories
- [x] Capture candidate artifact list

## Core

- [x] Remove artifacts/dumps from git
- [x] Identify and remove unused code/components (proven by search)
- [x] Update .gitignore if needed

## Tests

- [x] Run `pnpm run lint`
- [x] Run `pnpm run typecheck` (optional)

## Notes

- Assumptions:
  - Limited cleanup to artifacts/dumps and clearly unused files confirmed by repo search; no code/components removed without explicit usage proof.
- Deviations:
  - Removed legacy `components/` files with zero repo references: BetterIcon, ButtonGradient, Testimonial1Small, TestimonialRating, Testimonials11, Testimonials3, TestimonialsAvatars, TimeSlider, app-sidebar.
  - Removed tracked UI backup artifacts under `components/ui/.backup-20251003` and related temp/removed files; removed `src/app/globals.css.minimal-backup`.
  - Removed unused legacy directories `components/mobile/` and `components/reserve/booking-flow/` (no repo references).
  - Removed unused reserve shared modules: `reserve/shared/utils/booking.ts`, `reserve/shared/ui/Field.tsx`.
  - Removed unused legacy folders: `components/atoms`, `components/guest-account`, `components/invite`, `components/layout`, `components/marketing`, `components/owner-marketing`, `components/profile`.
  - Removed unused reserve legacy helpers/steps: `components/reserve/helpers.ts`, `components/reserve/steps/*` (kept `components/reserve/icons.tsx`).
  - Removed scratch file `src/app/layout.tsx.new` and empty `src/components/common/` index.
  - Removed unused ops/dashboard components: `components/ops/restaurants/RestaurantsClient.tsx`, `components/dashboard/BookingsListMobile.tsx`.
  - Removed tracked Supabase CLI temp cache: `supabase/.temp/*`; ignored via `.gitignore`.
  - Removed unused legacy components and ops dialogs with 0 repo references:
    `components/ButtonLead.tsx`, `components/ButtonPopover.tsx`, `components/ButtonSignin.tsx`,
    `components/ButtonSupport.tsx`, `components/Modal.tsx`, `components/Testimonials1.tsx`,
    `components/nav-main.tsx`, `components/nav-projects.tsx`, `components/nav-user.tsx`,
    `components/team-switcher.tsx`, `components/auth/SignInForm.tsx`,
    `components/dashboard/BookingRow.tsx`, `components/dashboard/StatusChip.tsx`,
    `components/ui/breadcrumb.tsx`, `components/ui/skeletons.tsx`,
    `components/ops/restaurants/CreateRestaurantDialog.tsx`,
    `components/ops/restaurants/DeleteRestaurantDialog.tsx`,
    `components/ops/restaurants/EditRestaurantDialog.tsx`,
    `components/ops/restaurants/RestaurantsTable.tsx`.
  - Removed unused legacy hooks with 0 repo references:
    `hooks/owner/useOperatingHours.ts`, `hooks/owner/useRestaurantDetails.ts`,
    `hooks/owner/useRestaurantMemberships.ts`, `hooks/owner/useServicePeriods.ts`,
    `hooks/owner/useTeamInvitations.ts`.
  - Removed unused shared libs with 0 repo references:
    `libs/api.ts`, `libs/gpt.ts`, `lib/api/errors.ts`, `lib/api/list-params.ts`,
    `lib/restaurants/api.ts`, `lib/restaurants/useRestaurants.ts`,
    `lib/utils/relative-time.ts`.
  - Removed unused barrels and utilities with 0 repo references:
    `types/index.ts`, `src/types/index.ts`, `src/services/index.ts`,
    `src/services/ops/index.ts`, `src/contexts/index.ts`, `src/hooks/use-countdown.ts`,
    `src/utils/index.ts`, `src/utils/shortcuts.ts`.
  - Removed unused styles with 0 repo references: `styles/animations.css`, `styles/base.css`.
  - Removed unused reserve/shared wrappers and unused scripts/server/features/hooks/components:
    `reserve/shared/ui/badge.tsx`, `reserve/shared/ui/separator.tsx`,
    `reserve/shared/ui/toggle.tsx`, `reserve/vitest.config.ts`,
    `route-scanner.js`, `send-all-emails.cjs`, `send-test-email.cjs`,
    `test-email.mjs`, `test-magic-link.mjs`, `trigger-signin.mjs`,
    `scripts/backfill-review-emails.ts`, `scripts/check-staging-supabase.ts`,
    `scripts/db-perf-baseline-rpc.ts`, `scripts/db-perf-baseline.ts`,
    `scripts/db-qa-tests.ts`, `scripts/debug-redirects.ts`,
    `scripts/debug-restaurants.ts`, `scripts/execute-sql.ts`,
    `scripts/find-supabase-region.ts`, `scripts/generate-bookings-safe.ts`,
    `scripts/production-precheck.ts`, `scripts/route-smoke.cjs`,
    `scripts/run-production-optimization.ts`,
    `scripts/run-schema-optimization.ts`, `scripts/seed-bookings-week-final.ts`,
    `scripts/seed-bookings-week.ts`, `scripts/test-summary-api.ts`,
    `server/cache/request-deduplication.ts`,
    `server/capacity/engine/filter.ts`, `server/capacity/engine/lookahead.ts`,
    `server/capacity/engine/window.ts`, `server/capacity/metrics.ts`,
    `server/jobs/allocations-pruner.ts`, `server/jobs/capacity-holds.ts`,
    `server/jobs/outbox-worker.ts`, `server/jobs/table-scarcity.ts`,
    `server/ops/strategic-config.ts`, `server/reservations/getReservation.ts`,
    `server/reservations/index.ts`, `server/test-api.ts`,
    `src/components/auth/SignInForm.tsx`,
    `src/components/landing/HomeSections.tsx`,
    `src/components/layouts/AuthLayout.tsx`,
    `src/components/layouts/AuthNavbar.tsx`,
    `src/components/layouts/index.ts`,
    `src/components/shared/FeatureCard.tsx`,
    `src/components/shared/PageHero.tsx`,
    `src/components/shared/PageSection.tsx`,
    `src/components/shared/index.ts`,
    `src/components/features/index.ts`,
    `src/components/features/bookings/index.ts`,
    `src/components/features/customers/index.ts`,
    `src/components/features/dashboard/index.ts`,
    `src/components/features/dashboard/RealtimeStatus.tsx`,
    `src/components/features/dashboard/manualHoldHelpers.ts`,
    `src/components/features/dashboard/manual-assignment/HoldExpirationTimer.tsx`,
    `src/components/features/dashboard/manual-assignment/index.ts`,
    `src/components/features/dashboard/booking-details/BookingAssignmentTabContent.tsx`,
    `src/components/features/ops-shell/OpsOfflineIndicator.tsx`,
    `src/components/features/ops-shell/index.ts`,
    `src/components/features/restaurant-settings/index.ts`,
    `src/components/landing/analytics/ExitIntentPopup.tsx`,
    `src/components/landing/analytics/index.ts`,
    `src/components/features/booking/wizard/StepPrefetchBoundary.tsx`,
    `src/components/features/tables/timeline/TableTimelineClient.tsx`,
    `src/components/features/tables/timeline/index.ts`,
    `src/hooks/ops/useManualAssignmentContext.ts`,
    `src/hooks/ops/useOpsBookingService.ts`,
    `src/hooks/ops/useOpsTodayVIPs.ts`,
    `src/hooks/ops/useRealtimeDiagnostics.ts`,
    `src/components/features/dashboard/manual-assignment/AssignmentToolbar.tsx`,
    `src/components/features/dashboard/manual-assignment/ValidationChecks.tsx`,
    `src/components/features/dashboard/TableFloorPlan.tsx`,
    `src/hooks/ops/useAssignmentContext.ts`.
  - Removed remaining unused wizard UI and compliance script:
    `reserve/features/reservations/wizard/ui/StepSummary.tsx`,
    `reserve/features/reservations/wizard/ui/types.ts`,
    `scripts/check-agents-compliance.cjs`.

## Batched Questions

- None
