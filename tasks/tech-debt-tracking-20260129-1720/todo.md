---
task: tech-debt-tracking
timestamp_utc: 2026-01-29T17:20:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add tech-debt issue template under `.github/ISSUE_TEMPLATE/`.
- [x] Add `TECH_DEBT.md` ledger with schema and status definitions.

## Core

- [x] Ensure template and ledger align with governance requirements.

## Tests

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.

## Notes

- Assumptions:
- Deviations:
