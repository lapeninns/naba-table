---
task: index-hygiene
timestamp_utc: 2026-02-07T14:41:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Index Hygiene (FK + Duplicate Indexes) — Staging

## Objective

Reduce unnecessary index bloat and eliminate FK-related sequential scans by:

- Adding missing FK prefix indexes in `public` (19 FKs).
- Dropping redundant/duplicate indexes as reported by the analysis artifacts.

## Success Criteria

- Missing FK supporting indexes count is **0** (verification query provided).
- Duplicate index groups (exact) return **0 rows**.
- Duplicate index groups (ignoring uniqueness) return **0 rows**.
- Preflight check confirms no planned drops are backing constraints.

## Execution Order (Staging)

1. Run preflight queries:
   - Confirm planned drop indexes are not backing constraints.
   - Capture current missing FK/duplicate reports (baseline).
2. Create missing FK indexes (idempotent).
3. Drop redundant/duplicate indexes (idempotent).
4. Run verification queries:
   - Missing FK indexes = 0
   - Duplicate groups = 0

## Lock / Safety Notes

- This plan intentionally does **not** use `CONCURRENTLY` (repo convention).
- `CREATE INDEX` will take a lock that blocks writes to the table while the index builds. Run during a low-traffic staging window if staging is shared.
- `lock_timeout` is set in the script so statements fail fast instead of waiting indefinitely if another session holds conflicting locks.

## Deliverable

- Concrete SQL script (DDL + verification queries):
  - `tasks/index-hygiene-20260207-1441/artifacts/index_hygiene_public.sql`
