---
task: react-query-config-build-fix
timestamp_utc: 2025-11-26T14:31:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review `src/app/providers.tsx` and helper functions for cache timing.

## Core

- [x] Update `QueryClientConfig` values to satisfy React Query v5 types while preserving logic.

## Tests

- [x] `pnpm run build`.

## Notes

- Assumptions: Cache helpers return numbers; only usage site typing is misaligned.
- Deviations: None.
