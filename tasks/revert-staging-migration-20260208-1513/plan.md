---
task: revert-staging-migration
timestamp_utc: 2026-02-08T15:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Revert Unwanted Staging Migration

## Objective

Make the repository migrations (`supabase/migrations/**`) the single source of truth again and ensure staging schema matches repo intent.

## Success Criteria

- [ ] Staging migration history has no _blocking_ remote-only applied versions (Supabase CLI `db push --linked --dry-run` is clean).
- [ ] If the unwanted migration introduced schema drift, staging schema is returned to the canonical repo schema via a forward-only revert migration.
- [ ] Verification evidence captured under `artifacts/`.

## Approach

1. Identify what `20260208115458` was:
   - Dump `supabase_migrations.schema_migrations` data to capture name/status.
2. Confirm if any schema drift exists vs repo migrations:
   - `supabase db diff --linked` (capture output).
3. If drift exists:
   - Author a new migration to revert the changes, using `DROP ... IF EXISTS` and explicit safety checks.
   - `supabase db push --linked --dry-run` then apply.
4. Verification:
   - Re-run `supabase db diff --linked` and `supabase migration list --linked`.

## Rollback Strategy

- DB changes: forward-only revert migration (explicit DDL) so the state is reproducible.
- Migration history: use `supabase migration repair --status reverted` for remote-only versions.
