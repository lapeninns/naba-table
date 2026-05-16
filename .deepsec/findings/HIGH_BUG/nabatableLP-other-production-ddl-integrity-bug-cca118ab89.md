# [HIGH_BUG] FK phase can drop constraints and continue with a successful process exit

**File:** [`scripts/run-production-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/run-production-optimization.ts#L99-L190) (lines 99, 101, 102, 104, 131, 136, 140, 183, 190)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-ddl-integrity-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The FK phase runs DROP CONSTRAINT, ADD CONSTRAINT, and VALIDATE CONSTRAINT as separate autocommitted commands. runPhase catches each command error, records it, and continues. main prints a warning summary but never sets a non-zero exit code for phase errors. If a DROP succeeds and the replacement ADD or VALIDATE fails, production can be left with a missing or invalid FK while automation still sees a successful process exit.

## Recommendation

Fail fast on DDL errors and set a non-zero exit code whenever any phase fails. For FK replacement, use a transaction or a single atomic ALTER TABLE where possible, and avoid dropping an existing constraint until the replacement can be installed safely.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-06)
