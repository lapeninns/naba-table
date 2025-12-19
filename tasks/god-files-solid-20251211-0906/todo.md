---
task: god-files-solid
timestamp_utc: 2025-12-11T09:06:54Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify largest/highest-coupling backend files
- [x] Choose target(s) for refactor and define boundaries (picked `server/capacity/table-assignment/assignment.ts`)

## Core

- [x] Extract smaller modules/services per responsibility
- [x] Add interfaces/ports where DI helps testing (confirm retry accepts injected confirm fn)
- [x] Update imports/callers

## Tests

- [x] Unit tests for new modules
- [ ] Run existing test suite for regression

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
