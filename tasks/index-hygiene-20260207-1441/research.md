---
task: index-hygiene
timestamp_utc: 2026-02-07T14:41:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Index Hygiene (FK + Duplicate Indexes) — Staging

## Inputs (Source of Truth)

- Missing FK supporting indexes:
  - `tasks/db-optimization-analysis-20260207-1402/artifacts/fk_missing_indexes_public.csv`
- Duplicate indexes (exact duplicates):
  - `tasks/db-optimization-analysis-20260207-1402/artifacts/index_duplicates_public.csv`
- Duplicate indexes (duplicates even when ignoring uniqueness):
  - `tasks/db-optimization-analysis-20260207-1402/artifacts/index_duplicates_ignoring_uniqueness_public.csv`
- Reference schema snapshot (staging at time of analysis):
  - `tasks/db-optimization-analysis-20260207-1402/artifacts/public_schema_dump.sql`

## Requirements / Constraints

- Postgres DDL only; no secrets.
- Apply to staging first (staging-only execution), but the SQL should be production-grade and idempotent.
- Use `CREATE INDEX IF NOT EXISTS` and `DROP INDEX IF EXISTS`.
- Avoid `CONCURRENTLY` (repo convention: non-concurrent index operations).
- Do not drop indexes that back constraints (PK/UNIQUE constraints).

## Key Findings

- There are 19 FK constraints in `public` whose referencing columns do not have a supporting _prefix_ btree index. These should be added to avoid FK maintenance scans and improve join performance.
- There are multiple redundant/duplicate indexes in `public`:
  - Some are exact duplicates (same columns and properties) with different names.
  - Some are redundant because a PRIMARY KEY / UNIQUE index already covers the same columns.

## Decisions (Keep vs Drop)

- If a PRIMARY KEY index exists for a duplicate signature, keep the PK and drop redundant non-PK duplicates.
- Else if a UNIQUE index exists, keep the UNIQUE one and drop non-UNIQUE duplicates.
- Else (non-unique duplicates only), keep one representative (prefer the one shown in the CSV sample definition) and drop the rest.
