---
task: fix-eslint-hooks-deps
timestamp_utc: 2026-01-04T19:01:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Audit hook deps in BookingAssignmentTabContent
- [x] Memoize queryKey in ops hooks
- [x] Update effect deps to use memoized keys

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should callbacks be restructured to avoid including `date`/`restaurantId`?
