# [HIGH_BUG] Production FK migration can drop constraints and still exit successfully

**File:** [`scripts/run-production-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-production-optimization.ts#L96-L185) (lines 96, 98, 99, 104, 105, 110, 111, 124, 129, 133, 176, 183, 185)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-ddl-integrity-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Phase 4 drops existing foreign keys, then adds and validates replacements as separate commands. `runPhase` catches each command error, records it, and continues; the caller only prints a summary and does not fail the process for phase errors. If a drop succeeds and the following add fails, production can be left without the FK. Even partial failures are easy to miss in CI because the script exits successfully unless a top-level fatal exception is thrown.

## Recommendation

Run each FK replacement as an atomic group where possible, abort immediately on DDL errors, and set a non-zero exit code if any phase has errors. Avoid dropping an existing constraint until the replacement strategy can be applied safely, with rollback documented.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
