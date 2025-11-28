---
task: booking-flow-venue-name
timestamp_utc: 2025-11-28T15:12:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Verification: Remove Default Restaurant Fallbacks

## Manual QA

- [ ] **Path 1**: Marketing Page -> Booking Flow.
  - URL: `/restaurants/{slug}/book`
  - Result: Blocked by auth redirect.
- [ ] **Path 2**: Rebook Flow.
  - Action: Click "Book again" on a past booking.
  - Result: Blocked by auth redirect.
- [ ] **Path 3**: SPA Route.
  - URL: `/reserve/r/{slug}`
  - Result: Blocked by auth redirect.

## Automated Tests

- [x] `reserve/features/reservations/wizard/hooks/__tests__/useReservationWizard.hydration.test.tsx` passed.
  - Verified hydration logic works when slug is present but details are missing.
  - Verified existing details are preserved.

## Artifacts

- [ ] HAR files.
- [ ] Screenshots.
