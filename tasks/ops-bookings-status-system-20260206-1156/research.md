---
task: ops-bookings-status-system
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Bookings Status UI Single Source of Truth

## Requirements

- Single source of truth for:
  - labels + descriptions
  - badge styling + icon
  - list rail styling
- All surfaces (Ops list, status filters, booking dialog) must render consistently.

## Existing Duplicates (to remove)

- `src/components/features/booking-state-machine/BookingStatusBadge.tsx` defines `BOOKING_STATUS_CONFIG`.
- `src/components/features/dashboard/StatusBadge.tsx` defines `STATUS_CONFIG`.
- `src/components/features/dashboard/booking-details/utils.ts` defines `STATUS_CONFIGS` + `getStatusConfig`.
- `src/components/features/dashboard/booking-details/components/BookingStatusBadge.tsx` depends on `getStatusConfig`.

## Recommended Direction

Create `lib/ops/booking-status.ts` and refactor all call sites to use it. Then delete the duplicate config implementations.
