---
task: clone-railway-three-horseshoes
timestamp_utc: 2026-02-11T11:49:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate source restaurant slug and owner membership.
- [x] Run clone script in dry-run mode.
- [x] Apply clone in production with project-ref guard.

## Core

- [x] Overwrite target restaurant details with provided Three Horseshoes data.
- [x] Ensure target has zero copied bookings and customers before seeding.
- [x] Seed synthetic bookings for 15 days at 40-50/day.

## UI/UX

- [x] N/A (no UI change)

## Tests

- [x] Dry-run clone summary reviewed.
- [x] Post-seed aggregate verification query run.

## Notes

- Assumptions:
- "Upcoming 15 days" interpreted as tomorrow to tomorrow+14 days in restaurant timezone.

- Deviations:
- `bookings.assignment_state` and `bookings.table_id` were excluded from insert payload due production schema cache availability.

## Batched Questions

- None.
