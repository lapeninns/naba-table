# Database Migrations

Reference for Supabase migration procedures. For binding rules, see root `/AGENTS.md`.

## Core Rule

Supabase is **remote-only**. Never run local Supabase for this project.

## Migration Workflow

1. Use Supabase MCP or `pnpm db:*` scripts for planning and apply
2. Apply to **staging first**, then production in a change window
3. Include rollback steps and dry-run diff in task artifacts
4. Production requires approval and on-call acknowledgment

## Safety Checklist

- [ ] Expansion → backfill → contraction pattern followed
- [ ] No long-running locking transactions
- [ ] Backfills are chunked and idempotent
- [ ] Backup/PITR verified before impactful schema changes
- [ ] Dry-run diff attached to artifacts/db-diff.txt
- [ ] Rollback plan documented
- [ ] Migration logged in docs/DATABASE_MIGRATIONS.md

## Read Replica Setup

See `supabase/AGENTS.md` for staging/preview read-replica wiring details.
