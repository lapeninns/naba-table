---
task: prod-db-rollout
timestamp_utc: 2026-02-08T00:24:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Pre-flight

- [ ] Confirm production backup/PITR readiness (manual).
- [x] `bash scripts/supabase/check_migration_versions_unique.sh`
- [x] Link to production: `supabase link --project-ref vrdiqfudmwydclqpydee`
- [x] Capture linked project ref + migration list into `artifacts/`.

## Baseline (Option A)

- [ ] Dry-run baseline selection:
  - `bash scripts/supabase/repair_migration_history_linked.sh --through 20260206213430 --dry-run`
- [x] Apply baseline:
  - `bash scripts/supabase/repair_migration_history_linked.sh --through 20260206213430`
- [x] Reconcile remote-only applied migrations (SQL Editor drift):
  - `bash scripts/supabase/revert_remote_only_migrations_linked.sh` (or `supabase migration repair --status reverted ...`)

## Apply

- [ ] Dry-run push shows only expected migrations:
  - `supabase db push --linked --dry-run`
- [x] Apply:
  - `supabase db push --linked --yes`

## Post-flight

- [x] `supabase migration list --linked`
- [x] `supabase db push --linked --dry-run` reports up to date
