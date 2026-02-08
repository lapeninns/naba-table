---
task: prod-db-rollout
timestamp_utc: 2026-02-08T00:24:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Plan: Production DB Rollout (Supabase CLI)

## Objective

Apply the forward-only migrations to production safely without replaying historical migrations.

## Success Criteria

- [ ] Production is linked intentionally (`supabase/.temp/project-ref` matches `vrdiqfudmwydclqpydee`).
- [ ] Production migration history is baselined through a conservative cutoff.
- [ ] `supabase db push --linked --dry-run` proposes **only** the expected forward migrations.
- [ ] `supabase db push --linked --yes` applies cleanly.
- [ ] Post-apply: `supabase db push --linked --dry-run` shows production is up to date.

## Baseline Cutoff Strategy

Because production has no reliable migration history (SQL Editor drift), we baseline through:

- `20260206213430`

This ensures production will still apply the critical hardening and index migrations:

- `20260207144113`
- `20260207170000`

If dry-run proposes more migrations than expected, stop and re-evaluate the cutoff.

## Rollout Steps

1. Verify migration versions are unique:
   - `bash scripts/supabase/check_migration_versions_unique.sh`
2. Link to production:
   - `supabase link --project-ref vrdiqfudmwydclqpydee`
3. Baseline production history (metadata only):
   - `bash scripts/supabase/repair_migration_history_linked.sh --through 20260206213430`
4. If production has remote-only applied migration versions that are not present locally (SQL Editor drift),
   reconcile them (metadata only) so `supabase db push` can proceed:
   - `bash scripts/supabase/revert_remote_only_migrations_linked.sh`
5. Dry-run push and confirm expected plan:
   - `supabase db push --linked --dry-run`
6. Apply migrations:
   - `supabase db push --linked --yes`
7. Post-apply verification:
   - `supabase migration list --linked`
   - `supabase db push --linked --dry-run`

## Rollback Notes

- RLS policy/grant changes can be reverted by re-applying prior policy DDL (requires prepared scripts).
- Index drops can be reverted by recreating indexes (may be expensive).
- Loyalty tables drops are not automatically reversible (data loss). Recover only from backup/PITR.
