---
task: assign-tables-atomic-duplicate-fix
timestamp_utc: 2026-03-27T13:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Code Verification

- Confirmed the failure came from the automated confirmation path:
  - inline auto-assign -> `atomicConfirmAndTransition`
  - automated retry wrapper -> `confirmWithPolicyRetry`
  - stale hold conflict surfaced from legacy `assign_tables_atomic_v2`
- Kept direct manual confirmation unchanged; only automated callers using `atomicConfirmAndTransition` receive the new recovery behavior.

## Test Outcomes

- Command:
  - `pnpm exec vitest run tests/server/capacity/policy-retry.test.ts`
- Result:
  - `2` tests passed
- Covered cases:
  - assignment conflict on first confirm triggers hold release, re-quote, and second confirm
  - assignment conflict with no replacement hold fails with `ASSIGNMENT_REQUOTE_FAILED`

## Sanity Checks

- `git diff --check` passed

## Remaining Production Follow-up

- Verify against a fresh production auto-assign booking that previously would have fallen back to `pending`.
