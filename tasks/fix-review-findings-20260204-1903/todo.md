---
task: fix-review-findings
timestamp_utc: 2026-02-04T19:03:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder + artifacts

## Core

- [x] Guard selectedDate update when `date` param is missing
- [x] Add replay start/stop on route transitions
- [x] Stabilize media-query hydration path for ops booking card

## Tests

- [ ] Lint
- [ ] Manual QA

## Notes

- Assumptions:
- Ops routes are `/app` path or `app.` subdomain.
- Deviations:
- None.

## Batched Questions

- None.
