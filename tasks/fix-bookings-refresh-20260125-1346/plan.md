---
task: fix-bookings-refresh
timestamp_utc: 2026-01-25T13:46:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix bookings not updating across devices

## Objective

We will ensure bookings data refreshes reliably across devices without forcing re-login.

## Success Criteria

- [ ] Guest bookings list reflects updates on a second device within the chosen refresh policy.
- [ ] No regressions to existing auth/session flows.

## Architecture & Components

- Guest bookings hook: `src/guest/hooks/useGuestBookings.ts`
- Guest UI consumers:
  - `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
  - `src/components/features/booking/list/BookingListClient.tsx`

## Data Flow & API Contracts

- No API contract changes. Keep existing `services.bookings.list` usage.

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Tab left open for a long time while bookings change elsewhere.
- Network reconnect after offline.

## Testing Strategy

- Unit: hook-level behavior (if tests exist for guest hooks).
- Integration/E2E: guest dashboard/bookings refresh in browser.
- Accessibility: no UI changes expected.

## Rollout

- Feature flag: not required (low-risk hook change).
- Monitoring: watch client error logs for query failures.
- Kill-switch: revert hook options if issues observed.

## DB Change Plan (if applicable)

- N/A
