---
task: supabase-baseline-migrations-runbook
timestamp_utc: 2026-02-07T15:50:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Supabase Baseline Migrations Runbook

## Objective

Enable safe, repeatable Supabase CLI migrations on top of existing remote databases (staging/prod),
even when historical schema changes were performed via SQL Editor and the migration history table is empty.

## Success Criteria

- [ ] A documented runbook exists for staging refresh and production rollout.
- [ ] A deterministic script exists to validate migration version uniqueness.
- [ ] A deterministic script exists to baseline (repair) migration history up to a chosen version.
- [ ] Staging can be refreshed (prod clone) and then accept new migrations without replaying history.
- [ ] `supabase db push --linked --dry-run` reports "Remote database is up to date" immediately after baseline.

## Approach

1. Documentation:
   - Add `docs/db/supabase-baseline-migrations.md` describing:
     - When to baseline
     - How to pick a cutoff version
     - Staging workflow (clone → baseline → apply new migrations → verify)
     - Production workflow (backup/PITR check → baseline once → staged rollout)
     - Failure modes and how to recover

2. Scripts:
   - `scripts/supabase/check_migration_versions_unique.sh`
     - Ensures `supabase/migrations` has a single file per version prefix.
   - `scripts/supabase/repair_migration_history_linked.sh`
     - Repairs migration history (applied) for `--linked` project.
     - Supports `--through <version>` to avoid marking future migrations applied.
     - Supports `--dry-run` to print versions without mutating remote.

3. Verification:
   - Run scripts locally against the currently linked staging project and confirm:
     - version uniqueness passes
     - repair script is idempotent
     - `supabase migration list --linked` and `supabase db push --dry-run` are clean

## Rollout

- Staging: run baseline immediately after production clone, then apply new migrations.
- Production: baseline once (or after a clone-style rebuild), then always apply forward migrations.
  Do baseline with a cutoff version that is known to already exist in production.

## Risks / Mitigations

- Risk: mistakenly marking future migrations as applied on production.
  Mitigation: require `--through <version>` and always run `supabase db push --dry-run` before any apply.
- Risk: duplicate version prefixes introduced in a PR.
  Mitigation: add the uniqueness check script to review/checklist; optionally wire to CI later.
