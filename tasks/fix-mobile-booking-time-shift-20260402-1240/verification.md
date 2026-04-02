---
task: fix-mobile-booking-time-shift
timestamp_utc: 2026-04-02T12:40:07Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
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

- Verified via `http://127.0.0.1:3000/dev/guest-bookings` because `/guest/bookings` redirects to sign-in in local dev.
- Spot-checked `http://127.0.0.1:3000/dev/ops-floor-plan` because the floor-plan path also depended on selected service date + time normalization.
- Console contained only expected dev/HMR/PostHog debug logs; no runtime exceptions or React errors.
- Network requests for the harness route and local assets returned `200`.
- After the shared normalizer/API changes, the mobile harness still rendered the corrected booking times.

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- Lighthouse snapshot (mobile):
  - Accessibility: 97
  - Best Practices: 100
  - SEO: 80
- Snapshot audit confirms the harness remains accessible after the timezone fix.

### Device Emulation

- [x] Mobile (390×844)

### Verification fallback

- `/guest/bookings` is auth-gated in local dev and redirects to `/auth/signin`.
- Added dev-only harness route `src/app/(public)/dev/guest-bookings/page.tsx` so Chrome DevTools verification can exercise the real `BookingListClient` without bypassing production auth behavior.

### Observed result

- UTC-backed booking (`2026-07-01T18:30:00.000Z`, `Europe/London`) rendered as `19:30`.
- Venue-local booking string (`2026-07-02T19:30`, `Europe/London`) also rendered as `19:30`.
- Guest list proof remained correct after replacing the local-only fix with the shared normalization path.
- Ops floor-plan mobile harness rendered service date `Thursday 2 April 2026` and timeline/header time `19:30` consistently, confirming the selected-date and time-label paths no longer rely on device-local midnight math.

## Test Outcomes

- [x] Focused component tests
- [x] `pnpm exec vitest run tests/components/BookingListClient.test.tsx`
- [x] `pnpm exec vitest run tests/components/BookingListClient.test.tsx tests/guest/bookingDateTime.test.ts tests/guest/reservationAdapter.test.ts tests/guest/booking-derivations.test.ts`
- [x] `pnpm exec vitest run tests/components/BookingListClient.test.tsx tests/guest/bookingDateTime.test.ts tests/guest/reservationAdapter.test.ts tests/guest/booking-derivations.test.ts tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts tests/components/OpsDashboardStateUtils.test.ts tests/utils/datetime.test.ts tests/ops/useFloorPlanTables.test.tsx`
- [x] `pnpm exec eslint src/components/features/booking/list/BookingListClient.tsx tests/components/BookingListClient.test.tsx 'src/app/(public)/dev/guest-bookings/page.tsx' 'src/app/(public)/dev/guest-bookings/ui/GuestBookingsDevHarness.tsx' --max-warnings=0`
- [x] `pnpm exec eslint src/components/features/booking/list/BookingListClient.tsx src/components/features/guest/dashboard/GuestDashboardClient.tsx src/components/features/guest/dashboard/booking-derivations.ts 'src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx' src/components/features/booking/detail/ReservationDetailClient.tsx reserve/entities/reservation/adapter.ts reserve/shared/formatting/bookingDateTime.ts 'src/app/api/bookings/route.ts' tests/components/BookingListClient.test.tsx tests/guest/bookingDateTime.test.ts tests/guest/reservationAdapter.test.ts tests/guest/booking-derivations.test.ts --max-warnings=0`
- [x] `pnpm exec eslint lib/utils/datetime.ts src/utils/ops/dashboard.ts src/components/features/dashboard/useOpsDashboardUiActions.ts src/components/features/bookings/components/OpsBookingsDatePicker.tsx src/components/features/dashboard/HeatmapCalendar.tsx src/utils/ops/mapOpsDashboardBookingItemToBookingDTO.ts server/booking/BookingValidationService.ts reserve/shared/formatting/bookingDateTime.ts src/services/ops/bookings.ts 'src/app/api/ops/bookings/[id]/assignment-context/route.ts' src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx src/components/features/seating/floor-plan/lib/date.ts src/components/features/seating/floor-plan/hooks/useFloorPlanTimelineConfig.ts src/components/features/seating/FloorPlanPage.tsx src/components/features/seating/floor-plan/hooks/useFloorPlanTables.ts tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts tests/components/OpsDashboardStateUtils.test.ts tests/utils/datetime.test.ts --max-warnings=0`
- [x] `pnpm run typecheck`

## Artifacts

- Vitest output: `artifacts/vitest-booking-list.txt`
- Vitest output (repo sweep): `artifacts/vitest-repo-time-consistency.txt`
- Mobile screenshot: `artifacts/guest-bookings-mobile.png`
- Mobile screenshot (post sweep): `artifacts/guest-bookings-mobile-post-sweep.png`
- Mobile screenshot (ops floor plan): `artifacts/ops-floor-plan-mobile-post-sweep.png`
- Lighthouse JSON: `artifacts/lighthouse-guest-bookings/report.json`
- Lighthouse HTML: `artifacts/lighthouse-guest-bookings/report.html`

## Known Issues

- [ ] I did not do a full audit of unrelated non-booking domains (team invitations, analytics timestamps, etc.); this sweep is focused on booking/ops date-time consistency.

## Sign-off

- [x] Engineering
