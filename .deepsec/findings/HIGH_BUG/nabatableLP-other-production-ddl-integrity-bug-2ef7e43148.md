# [HIGH_BUG] Production FK phase can leave constraints dropped while exiting successfully

**File:** [`scripts/run-production-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-production-optimization.ts#L96-L185) (lines 96, 98, 99, 101, 104, 105, 107, 110, 111, 113, 124, 127, 129, 133, 176, 183, 185)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-ddl-integrity-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The production optimization script drops each existing foreign-key constraint in one command, then adds and validates the replacement in later commands. runPhase catches command errors, records them, continues to subsequent commands, and main only prints a warning-style summary without setting a non-zero exit code for phase failures. If DROP CONSTRAINT succeeds but the ADD or VALIDATE step fails because of locks, permissions, schema drift, or data inconsistency, production can be left without the original FK enforcement while the process still exits successfully.

## Recommendation

For each FK, use a transaction or another atomic sequence that rolls back the drop if the replacement cannot be added. Stop on the first DDL failure, set process.exitCode=1 when any phase has errors, and preflight data/lock conditions before altering production constraints.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)

**Verdict:** fixed

`scripts/run-production-optimization.ts` now executes each FK replacement as a transactional command group through `runTransactionalPhase`. If an `ADD CONSTRAINT` or `VALIDATE CONSTRAINT` step fails after a drop, the transaction rolls back that constraint group, the FK phase stops, and the final summary throws when any phase has errors so the process exits non-zero. Focused script-safety tests assert the production runner uses the transactional phase helper and fails hard when `failedPhases.length > 0`.
