---
task: fix-booking-dto-cache
timestamp_utc: 2026-02-05T17:40:25Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review current DTO cache signature and table assignment structure.

## Core

- [x] Add deterministic table assignment signature to cache key.
- [ ] Verify behavior with reassignment scenario.

## UI/UX

- [ ] Confirm card labels update after reassignment.

## Tests

- [ ] Manual QA (ops dashboard).

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
