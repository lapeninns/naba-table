---
task: auto-assign-no-tables-retry-guard
timestamp_utc: 2026-02-16T18:54:56Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auto-Assign No-Tables Retry Guard

## Objective

Allow async auto-assign to perform one additional attempt before hard-stop for `hard.no_tables`-style outcomes, and make failed quote diagnostics consistently available.

## Success Criteria

- [ ] Auto-assign does not hard-stop on first `hard.no_tables`/`hard.no_suitable_tables` attempt.
- [ ] Auto-assign guarantees at least one follow-up attempt for deferred hard-stop cases.
- [ ] Other hard failures still stop immediately.
- [ ] Failed quote telemetry includes planner internal stats without requiring debug profiling.
- [ ] Tests cover retry policy behavior.

## Architecture & Components

- `server/jobs/auto-assign-retry-policy.ts`
  - Central policy for whether a hard classification should stop immediately.
- `server/jobs/auto-assign.ts`
  - Apply policy in no-hold path and adjust max attempts when deferring hard stop.
- `server/capacity/table-assignment/quote.ts`
  - Attach `plannerStats` on failures regardless of debug profiling flag.
- `tests/server/jobs/auto-assign-retry-policy.test.ts`
  - Unit coverage for defer vs hard-stop decisions.

## Data Flow & API Contracts

- No API surface changes.
- Internal behavioral contract:
  - Input: planner classification + attempt index.
  - Output: `immediate hard-stop` or `defer once`.

## Testing Strategy

- Unit tests for retry policy helper.
- Existing planner reason tests remain as guard.
- Typecheck + targeted vitest run.

## Rollout

- No feature flag for this patch (small, bounded behavior change).
- Validate via observability events:
  - `auto_assign.hard_stop_deferred` should appear only for attempt 0 and no-table codes.
  - subsequent attempts should proceed or stop with normal hard-stop behavior.
