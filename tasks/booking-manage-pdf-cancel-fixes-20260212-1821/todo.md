---
task: booking-manage-pdf-cancel-fixes
timestamp_utc: 2026-02-12T18:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate confirmation, booking detail, cancellation hook, and API route implementations.

## Core

- [x] Remove confirmation manage-booking action.
- [x] Enable session-recovery token access in confirmation PDF API route.
- [x] Sync reservation detail query cache on cancellation (optimistic + rollback + invalidate).
- [x] Add API fail-fast guard to block updates of cancelled bookings.

## UI/UX

- [x] Verify action bar no longer shows broken CTA.
- [x] Verify cancelled booking immediately disables mutate actions.

## Tests

- [x] Run targeted lint/type checks for touched files.
- [x] Manual smoke verification in browser/devtools.

## Notes

- Assumptions: session recovery cookie/token remains canonical guest access path.
- Deviations: used API smoke tests against existing remote records rather than end-to-end UI cancellation to avoid mutating live reservations.

## Batched Questions

- none.
