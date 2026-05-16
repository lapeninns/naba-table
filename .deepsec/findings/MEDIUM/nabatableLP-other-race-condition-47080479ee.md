# [MEDIUM] Hold conflict enforcement fails open when strict conflicts are disabled

**File:** [`server/capacity/holds.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/holds.ts#L130-L746) (lines 130, 136, 247, 308, 639, 746)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createTableHold configures the database session from isHoldStrictConflictsEnabled() and then relies on the insert path for atomic conflict prevention. When the flag is false, callers fall back to a separate findHoldConflicts pre-check before insertion, which is not atomic. Concurrent booking or staff hold requests for the same tables can both observe no conflict and then both insert overlapping holds if the database GUC disables the exclusion enforcement. The file also lets legacy conflict detection return an empty conflict set when schema/view relationships are unavailable, which compounds the fail-open behavior.

## Recommendation

Make active-hold overlap prevention fail closed and independent of a runtime feature flag. Keep the database exclusion constraint/RPC enforcement always on for writes, or move hold creation into a single transactional RPC that checks and inserts under a constraint or advisory lock. Treat inability to verify conflicts as an error, not as no conflicts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-03)

## Remediation

**Verdict:** fixed

Strict hold conflict enforcement is now always enabled for hold operations, RPC setup/verification failures throw before writes, and conflict-window query failures no longer fall back to legacy read-before-write checks.

**Verification:** `pnpm exec vitest run tests/server/capacity/table-assignment-guards.test.ts tests/server/deepsec-final-controls-source.test.ts`
