---
task: dev-tooling-tests
timestamp_utc: 2026-01-29T14:05:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing CI drift check expectations and test tooling scripts.

## Core

- [x] Add `scripts/db/check-drift.ts` implementation.
- [x] Add `scripts/tests/check-test-quality.ts` implementation.
- [x] Wire `test:quality` script into `package.json`.

## Tests

- [x] Run validators: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes

- Assumptions:
- Deviations: Ops E2E specs now register only when ops credentials are configured (no `.skip`).

## Batched Questions

- None.
