---
task: db-optimization-index-followups
timestamp_utc: 2026-02-07T16:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Index Follow-ups After Staging Hardening

## Context

- Target environment: Supabase staging project `ndxmivcrehsacuerwxtm`.
- Prior hardening migration already applied: `20260207144113_rls_hardening_internal_tables.sql`.
- Baseline migration history model: **Option A (baseline + forward-only)**.
  - Runbook: `docs/db/supabase-baseline-migrations.md`.

## Findings

- After applying the hardening migration, a small number of FK constraints were still detected as lacking a non-partial prefix index.
- `supabase db push` (CLI) **does not support** `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` due to pipelined execution.
  - Postgres error: `cannot be executed within a pipeline (SQLSTATE 25001)`.
  - Implication: production index creation/removal via migrations must be scheduled in a change window (or run via a non-pipelined workflow).

## Change Summary (This Task)

- Added a follow-up migration to cover remaining FK indexes:
  - `supabase/migrations/20260207170000_add_remaining_fk_indexes.sql`
- Adjusted comments and guidance in:
  - `supabase/migrations/20260207144113_rls_hardening_internal_tables.sql`
