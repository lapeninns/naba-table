---
task: db-hardening-staging
timestamp_utc: 2026-02-07T14:39:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: DB Hardening + Index Hygiene + Loyalty Removal (Staging)

## Goal

Implement the top recommendations from `tasks/db-optimization-analysis-20260207-1402/` against the **staging** Supabase Postgres DB.

## Scope

- Target DB: Supabase staging `ndxmivcrehsacuerwxtm`.
- Workstreams (requested by user):
  - P0 security: tighten RLS + privileges for internal tables.
  - P1 performance: add missing FK indexes and remove redundant/duplicate indexes.
  - Remove loyalty fully (DB objects + code), since loyalty is permanently deprecated.

## Inputs / Evidence

- Analysis: `tasks/db-optimization-analysis-20260207-1402/research.md`
- Index audit: `tasks/db-optimization-analysis-20260207-1402/artifacts/index_duplicates_ignoring_uniqueness_public.csv`
- Missing FK indexes: `tasks/db-optimization-analysis-20260207-1402/artifacts/fk_missing_indexes_public.csv`
- Risky RLS policies: `tasks/db-optimization-analysis-20260207-1402/artifacts/rls_policies_role_public_risky.csv`

## Constraints

- Supabase operations are remote-only.
- Use staging only (no production).
- Do not log or commit secrets.
- Deletions are explicitly requested for loyalty (DB + code), but still keep changes scoped.
