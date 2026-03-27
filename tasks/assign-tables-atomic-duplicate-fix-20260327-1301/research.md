---
task: assign-tables-atomic-duplicate-fix
timestamp_utc: 2026-03-27T13:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Research: Assign Tables Atomic Duplicate Fix

## Requirements

- Functional:
  - Prevent automated booking confirmation flows from hard-failing when a quoted hold becomes stale before `assign_tables_atomic_v2` commits.
  - Preserve explicit manual hold confirmation behavior; do not silently swap operator-selected tables.
- Non-functional:
  - Keep the fix scoped to the automated confirm path.
  - Preserve existing observability for retries and failures.

## Existing Patterns & Reuse

- Automated confirmation already retries once for `PolicyDriftError` in [policy-retry.ts](/Users/amankumarshrestha/.cline/worktrees/da611/nabatableLP/server/capacity/table-assignment/policy-retry.ts).
- Public and ops inline auto-assign flows both use [src/services/inline-auto-assign.ts](/Users/amankumarshrestha/.cline/worktrees/da611/nabatableLP/src/services/inline-auto-assign.ts), which calls `atomicConfirmAndTransition`.
- Direct staff confirm uses `confirmHoldAssignment` directly and should remain unchanged.

## Constraints & Risks

- The logged production error came from the legacy `assign_tables_atomic_v2` fallback path: `assignment duplicate for table ...`.
- The duplicate indicates a stale hold or concurrent assignment race after quote time, not a booking-create failure.
- Retrying at the wrong layer could silently replace manually chosen tables.

## Recommended Direction

- Extend `confirmWithPolicyRetry` so automated callers can recover once from retryable assignment conflicts in the same way they already recover from policy drift:
  - release stale hold
  - re-quote
  - retry confirm
- Restrict this to `atomicConfirmAndTransition` callers so manual confirm routes still surface conflicts directly.
