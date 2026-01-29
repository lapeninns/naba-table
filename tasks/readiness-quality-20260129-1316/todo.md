---
task: readiness-quality
timestamp_utc: 2026-01-29T13:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Enable strict TypeScript in tsconfig.
- [x] Add dead code/unused dependency tooling.
- [x] Add duplicate code tooling.
- [x] Configure Vitest coverage thresholds.

## Core

- [x] Fix strict typing errors.
- [x] Wire new scripts into package.json.

## Tests

- [x] Run validators: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes

- Assumptions: coverage thresholds can start conservative.
- Deviations: none.
