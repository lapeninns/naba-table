---
task: revert-staging-migration
timestamp_utc: 2026-02-08T15:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Commands Run

- `supabase migration list --linked`
- `bash scripts/supabase/revert_remote_only_migrations_linked.sh --dry-run`
- `supabase db push --linked --dry-run`
- `supabase db dump --linked --schema supabase_migrations --file tasks/revert-staging-migration-20260208-1513/artifacts/supabase_migrations_schema.sql`
- `supabase db dump --linked --data-only --schema supabase_migrations --file tasks/revert-staging-migration-20260208-1513/artifacts/supabase_migrations_schema_migrations_data.sql`
- `supabase db dump --linked --schema public --file tasks/revert-staging-migration-20260208-1513/artifacts/public_schema.sql`
- `supabase db push --linked --dry-run` (for migration `20260208162105_drop_non_repo_public_objects.sql`)
- `supabase db push --linked` (applied migration `20260208162105_drop_non_repo_public_objects.sql`)
- `supabase db dump --linked --schema public --file tasks/revert-staging-migration-20260208-1513/artifacts/public_schema_after_drop.sql`

## Results

- Migration history cleanup:
  - The remote-only migration version `20260208115458` is no longer listed by `supabase migration list --linked`.
  - Post-cleanup, `bash scripts/supabase/revert_remote_only_migrations_linked.sh --dry-run` reports no remote-only applied migrations.
- Push safety:
  - `supabase db push --linked --dry-run` reports remote is up to date.
- Schema cleanup:
  - Identified staging-only `public` objects not referenced in canonical repo paths and removed them via migration:
    - `supabase/migrations/20260208162105_drop_non_repo_public_objects.sql`
  - Post-apply schema dump confirms the targeted tables/functions are absent.
  - Only two sequences remain from the candidate list (`_migrations_id_seq`, `booking_state_history_id_seq`), which are expected to be implicit dependencies of kept tables and were intentionally not dropped.

## Notes / Limitations

- `supabase db diff --linked` is not usable with the current baseline model because earlier migrations are not replayable from an empty shadow DB.
  - Symptom: shadow DB migration replay fails on `20251219003000_add_reservation_lifecycle_grace_minutes.sql` because `public.restaurants` does not exist in the shadow database.
  - Consequence: we cannot automatically generate a drift-based revert migration from `db diff` output.

## Artifacts

- Migration list (after): `artifacts/migration_list_linked_after.txt`
- Remote-only revert dry run (after): `artifacts/revert_remote_only_dry_run_after.txt`
- `db push` dry run (after): `artifacts/db_push_dry_run_after.txt`
- supabase_migrations schema: `artifacts/supabase_migrations_schema.sql`
- supabase_migrations schema_migrations data dump: `artifacts/supabase_migrations_schema_migrations_data.sql`
- `db diff` note: `artifacts/db_diff_linked_note.txt`
- Public schema (before): `artifacts/public_schema.sql`
- Public schema (after drop): `artifacts/public_schema_after_drop.sql`
- Public object inventory (before): `artifacts/public_schema_object_inventory.txt`
- Drop candidates (before): `artifacts/public_schema_drop_candidates.txt`
- Drop candidates still present (after): `artifacts/post_drop_candidates_still_present.txt`
