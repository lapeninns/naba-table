---
task: auto-assign-no-tables-retry-guard
timestamp_utc: 2026-02-16T18:54:56Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Add retry policy helper for hard classification handling.
- [x] Integrate helper into `auto-assign.ts` no-hold path.
- [x] Guarantee second attempt when deferring hard-stop and max attempts is 1.
- [x] Emit observability event for deferred hard-stop decision.

## Diagnostics

- [x] Ensure quote failures always carry planner stats in `QuoteTablesResult`.

## Tests

- [x] Add unit tests for retry policy behavior.
- [x] Run targeted vitest tests.
- [x] Run typecheck.

## Notes

- Assumptions:
  - Existing classification strings are stable (`hard.no_tables`, `hard.no_suitable_tables`).
- Deviations:
  - None.
