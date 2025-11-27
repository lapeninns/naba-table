---
task: bookings-sort-order
timestamp_utc: 2025-11-27T14:32:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify bookings data fetch implementation and existing sort.

## Core

- [x] Update query to order by creation datetime descending.
- [ ] Ensure pagination/filters still function with new sort.

## UI/UX

- [ ] Confirm list renders unchanged except order.

## Tests

- [ ] Add or adjust test covering ordering (if applicable).

## Notes

- Assumptions: Booking `created_at` field exists and reflects creation time.
- Deviations: None yet.
- Blockers: Need authenticated ops session and seed data to validate Recent ordering in UI.

## Batched Questions

- None currently.
