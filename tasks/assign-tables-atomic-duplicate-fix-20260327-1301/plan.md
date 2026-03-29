---
task: assign-tables-atomic-duplicate-fix
timestamp_utc: 2026-03-27T13:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Assign Tables Atomic Duplicate Fix

## Objective

We will make automated table confirmation recover from stale-hold assignment conflicts so public and ops auto-assignment do not fall back to `pending` when a fresh re-quote can still find a valid table.

## Success Criteria

- [ ] Automated confirm retries once on retryable assignment conflicts.
- [ ] Manual confirm code paths are unchanged.
- [ ] Tests cover conflict recovery and conflict re-quote failure.

## Architecture & Components

- [policy-retry.ts](/Users/amankumarshrestha/.cline/worktrees/da611/nabatableLP/server/capacity/table-assignment/policy-retry.ts)
  - add retry classification for assignment conflicts
  - reuse existing hold release + re-quote loop
- [tests/server/capacity/policy-retry.test.ts](/Users/amankumarshrestha/.cline/worktrees/da611/nabatableLP/tests/server/capacity/policy-retry.test.ts)
  - add focused unit coverage

## Edge Cases

- Conflict persists after re-quote: surface a clear retry-failed error.
- Re-quote returns no hold: surface failure without looping indefinitely.
- Policy drift handling must continue to work as before.

## Testing Strategy

- Unit:
  - conflict on first confirm, success on second confirm
  - conflict on first confirm, no replacement hold available
