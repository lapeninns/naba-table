---
task: prevent-past-booking-modification
timestamp_utc: 2025-11-25T17:03:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate booking update/delete logic (API + UI) and date utilities.

## Core

- [x] Add server-side guard preventing update/delete when booking is in the past.
- [x] Update client booking detail page to disable edit/delete for past bookings.
- [x] Provide user-facing error/message when action blocked.

## UI/UX

- [ ] Ensure focusable elements remain accessible; include aria-live for messaging if needed.

## Tests

- [x] Add unit/integration tests for server guard.
- [ ] Add UI/component test coverage for disabled actions on past booking.

## Notes

- Assumptions: No admin override required unless specified later.
- Deviations: None yet.

## Batched Questions

- Clarify reference timezone for “past”.
