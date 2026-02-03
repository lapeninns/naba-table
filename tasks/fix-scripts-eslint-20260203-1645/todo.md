---
task: fix-scripts-eslint
timestamp_utc: 2026-02-03T16:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm eslint warning locations.

## Core

- [x] Fix unused type/value in `seed-railway-from-cornerhouse.ts`.
- [x] Fix unused parameter in `seed-railway-from-cornerhouse.ts`.
- [x] Fix unused catch param in `update-railway-details.ts`.

## Tests

- [x] Run eslint on scripts.

## Notes

- Assumptions:
- Changes should be no-op for runtime behavior.
- Deviations:
- None.
