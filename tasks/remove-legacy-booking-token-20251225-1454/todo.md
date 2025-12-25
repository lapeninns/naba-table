---
task: remove-legacy-booking-token
timestamp_utc: 2025-12-25T14:54:29Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inventory legacy token usage (`token` query) across booking detail flows

## Core

- [x] Update booking detail page to remove legacy token handling
- [x] Update booking detail API GET to reject legacy token usage
- [x] Remove token propagation in ReservationDetailClient/useReservation
- [x] Update manage link generation to always use access tokens

## UI/UX

- [ ] Ensure guest access still works via `sr_access` cookie
- [x] Provide clear legacy-token error path

## Tests

- [x] Update booking route tests for new token behavior

## Notes

- Assumptions:
  - Confirmation token flow (`/api/bookings/confirm`) remains for booking confirmation only.
- Deviations:

## Batched Questions

- None
