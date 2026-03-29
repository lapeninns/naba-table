---
task: ops-booking-card-view-model-policy
timestamp_utc: 2026-03-29T22:34:59Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current card builder, selector, dashboard consumer, and tests
- [x] Create task artifacts and continuity ledger

## Core

- [x] Define canonical grouped row contract in `opsBookingCardUtils.ts`
- [x] Normalize guest identity, labels, table state, urgency, footer label, and action policy
- [x] Update selector/dashboard builder call sites without changing scope

## UI/UX

- [x] Update card/header/details/actions components to consume grouped submodels only

## Tests

- [x] Update builder and selector unit tests for new contract
- [x] Update no-show action test for the new action props shape
- [x] Run targeted test suite

## Notes

- Assumptions:
  - User prompt is the authoritative constraint set for this refactor.
- Deviations:
  - Chrome DevTools verification against this worktree is blocked by a stale `.next/dev/lock`; `localhost:3000` is serving a different checkout and cannot validate this diff.

## Batched Questions

- None at the moment.
