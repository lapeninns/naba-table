---
task: remove-loyalty-pilot-env
timestamp_utc: 2026-02-07T14:56:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm all runtime references to `LOYALTY_PILOT_RESTAURANT_IDS` and derived helpers.

## Core

- [x] Remove env key from `config/env.schema.ts`.
- [x] Remove export/plumbing from `lib/env.ts`.
- [x] Remove usage + dead helper from `server/feature-flags.ts`.

## Docs

- [x] Verify `.env.example` and docs do not mention this env var (remove if present).

## Tests

- [x] Run lint (repo-standard).
- [x] Run env validation (repo-standard).
- [ ] Run typecheck (blocked: repo currently has pre-existing TS errors unrelated to this change).

## Notes

- Assumptions:
  - `isLoyaltyPilotRestaurant()` has no external call sites (confirmed via repo search).
- Deviations:
  - None.
