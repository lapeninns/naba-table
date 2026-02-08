---
task: revert-staging-migration
timestamp_utc: 2026-02-08T15:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Revert Unwanted Staging Migration

## Request

- User request (2026-02-08): staging had a migration applied; user removed it from commit and wants:
  - cleanup migration history so repo is canonical
  - undo the actual schema changes performed

## Environment

- Supabase is remote-only.
- Current linked Supabase project ref (from `supabase/.temp/project-ref`): `ndxmivcrehsacuerwxtm`.

## Evidence So Far

- `supabase migration list --linked` previously showed a remote-only migration version:
  - Version: `20260208115458` (remote-only; local missing)

## Findings

- After applying `supabase migration repair --status reverted` for `20260208115458`, the version is no longer listed in `supabase migration list --linked`.
- The staging project migration history now has no remote-only applied versions that would block `supabase db push`:
  - `bash scripts/supabase/revert_remote_only_migrations_linked.sh --dry-run` => "No remote-only applied migrations found."
- The migration statements for applied versions are stored in `supabase_migrations.schema_migrations` (columns: version, statements, name).
  - Once a version is marked reverted, it no longer appears in this table, so its statements cannot be recovered from the DB after the fact.

## Open Questions

- What was the SQL content of version `20260208115458` (not present in `supabase/migrations/`)?
- Did it change schemas excluded by default dumps (e.g., `auth`, `storage`, etc.)?

## Next Steps

- Dump migration history row(s) for version `20260208115458` from `supabase_migrations.schema_migrations`.
- Produce a schema diff (repo migrations vs linked staging).
- If drift exists, create a forward-only revert migration under `supabase/migrations/` and apply to staging.
