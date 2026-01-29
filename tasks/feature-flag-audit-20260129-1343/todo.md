---
task: feature-flag-audit
timestamp_utc: 2026-01-29T13:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm feature flag definitions in `lib/env.ts` and `lib/env-client.ts`.

## Core

- [x] Add `scripts/feature-flags/audit.ts` with AST-based scanning.
- [x] Ensure `pnpm flags:audit` runs and reports unused/undefined paths.

## Tests

- [x] Run validators: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
