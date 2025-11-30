---
task: party-size-numeric
timestamp_utc: 2025-11-30T12:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm relevant API routes for booking updates (guest + ops).

## Core

- [x] Update guest/ops booking update schema to coerce `partySize` to number.
- [x] Update ops booking update schema to coerce `partySize` to number.

## Tests

- [ ] (Optional) Add/adjust test or local manual check.

## Notes

- Assumptions: Payloads may arrive as numeric strings from UI; bounds must stay unchanged.
- Deviations: Skipping automated test addition unless time permits.

## Batched Questions

- None.
