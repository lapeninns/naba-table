---
task: remove-floor-plan
timestamp_utc: 2026-04-03T16:41:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Remove floor-plan navigation exposure.
- [x] Redirect canonical and legacy floor-plan routes to dashboard.

## Core

- [x] Delete the floor-plan feature component tree.
- [x] Delete floor-plan dev harnesses.

## Tests

- [x] Delete floor-plan-focused tests.
- [x] Re-run scoped validation for the removal.

## Notes

- Assumptions: `/dashboard` is the correct fallback destination once floor plan is removed.
- Deviations: retained the legacy route files only as redirect entrypoints so old deep links do not break.

## Batched Questions

- None at the moment.
