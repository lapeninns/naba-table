---
task: booking-availability-edit-bug
timestamp_utc: 2025-11-27T23:58:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm reproducible root cause: authenticated `/api/bookings/[id]` response lacked restaurant slug, so EditBookingDialog flagged missing schedule metadata.

## Core

- [x] Trace availability-fetch call and required restaurant context.
- [x] Fix missing restaurant info propagation so availability loads when editing.
- [ ] Ensure error handling surfaces actionable message only when truly missing.

## UI/UX

- [ ] Validate modal states (loading/error/slots) still render correctly.

## Tests

- [x] Add/adjust unit/integration test covering booking GET restaurant metadata.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
