---
task: ops-bookings-a11y-touch
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Bookings A11y + Touch Targets

## Requirements

- Functional:
  - No business logic changes. Booking lifecycle actions and filtering/search behavior must remain correct.
- Non-functional:
  - Accessibility: touch targets >= 44x44 on mobile for primary interactions; keyboard navigation preserved; skip link; aria-live summary.
  - Usability: search inputs must be consistent and mobile-safe (16px font to avoid iOS zoom).
  - Maintainability: use existing shadcn primitives; avoid new primitives.

## Existing Patterns & Reuse

- List surface:
  - `src/app/app/(app)/bookings/page.tsx` -> `src/components/features/bookings/OpsBookingsClient.tsx` -> `components/dashboard/BookingsTable.tsx` -> `src/components/features/dashboard/cards/OpsBookingCard.tsx`
- Existing header search:
  - `components/dashboard/BookingsHeader.tsx`
- Ops toolbar search:
  - `src/components/features/bookings/OpsBookingsClient.tsx` (search slot in `OpsPageToolbar`)
- Offline banner:
  - `src/components/features/booking-state-machine/BookingOfflineBanner.tsx`

## Risks

- Touch target changes could affect layout density on desktop if not scoped to `sm:` breakpoints.
- Skip link requires a focusable target; we will use `tabIndex={-1}` only for ops variant.

## Recommended Direction

Implement touch target and typography floor changes, introduce a shared search component for consistent UI, move offline banner into the sticky toolbar area, and add basic a11y scaffolding.
