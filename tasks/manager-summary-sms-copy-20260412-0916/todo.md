---
task: manager-summary-sms-copy
timestamp_utc: 2026-04-12T09:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect the canonical daily summary formatter and current worker preview path

## Core

- [x] Update the shared formatter to the approved compact venue-prefixed SMS copy
- [x] Thread the venue name into the Cloudflare preview builder
- [x] Preserve optional `Other` output when needed for totals accuracy

## Tests

- [x] Update focused formatter and worker tests
- [x] Run targeted Vitest coverage
- [x] Run full TypeScript check

## Notes

- Assumptions:
  - The approved copy should remain single-line in the common case.
- Deviations:
  - None so far.

## Batched Questions

- None.
