---
task: fix-realtime-floorplan-env
timestamp_utc: 2026-01-25T13:06:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm target environment is production

## Core

- [ ] Inspect `scripts/validate-env.ts` for boolean validation
- [ ] Decide between env-only change vs code default

## Tests

- [ ] Validate build if requested

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should we set Vercel env only, or also add a code default?
