---
task: feature-flag-cleanup
timestamp_utc: 2026-01-29T15:23:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Remove unused flags from `lib/env.ts` and `lib/env-client.ts`.
- [x] Update env schema/test mocks to align with updated flags.

## Tests

- [x] Run `pnpm flags:audit`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.

## Notes

- Assumptions:
- Deviations:
