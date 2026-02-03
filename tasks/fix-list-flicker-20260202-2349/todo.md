---
task: fix-list-flicker
timestamp_utc: 2026-02-02T23:49:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify flicker triggers in `CustomersTable`, `BookingsList`, and `BookingsTable`.
- [x] Add `motion` dependency.
- [x] Identify ops auth redirect targets for `/app` routes.

## Core

- [x] Gate row animations to initial mount only.
- [x] Reduce re-measure calls to necessary cases.
- [x] Replace CSS animate-in classes with Motion opacity transitions.
- [x] Move Motion to list containers and use translate3d for virtualized rows.
- [x] Update ops `/app` redirects to `/app/auth/signin`.

## UI/UX

- [ ] Preserve focus handling and a11y behavior.

## Tests

- [ ] Chrome DevTools MCP manual QA (customers + bookings).
- [x] Verify `/app` unauthenticated redirect lands on ops sign-in (not guest signup).

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should we disable row animations for lists below a certain size?
