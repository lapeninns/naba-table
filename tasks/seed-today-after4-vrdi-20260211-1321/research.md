---
task: seed-today-after4-vrdi
timestamp_utc: 2026-02-11T13:21:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Seed same-day bookings after 4pm on vrdi production

## Requirement

- Add synthetic bookings for `three-horseshoes` on today (`2026-02-11`) after 16:00 local time.

## Context

- Target project: `vrdiqfudmwydclqpydee`.
- Restaurant slug: `three-horseshoes` (`6858b423-5007-45d8-bccd-7d630eaa05bc`).
- Existing count before run: 0 bookings today.

## Constraints

- Data must remain synthetic only.
- Time window must be >= 16:00 local.
- Preserve assignment integrity (`booking_table_assignments`).
