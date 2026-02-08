---
task: supabase-baseline-migrations-runbook
timestamp_utc: 2026-02-07T15:50:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Supabase Baseline Migrations Runbook

## Problem Statement

We want to manage database changes with Supabase CLI migrations on top of an existing remote database
that may have been evolved via SQL Editor and/or is created by cloning production into staging.

Key failure mode: when the remote database has **no** `supabase_migrations.schema_migrations` history,
`supabase db push` will attempt to replay **all** local migration files in version order, which is
unsafe against a production-clone schema and can fail immediately due to real FK dependencies.

## Requirements

- Use Supabase CLI and remote-only workflows (no local Supabase migrations for this project).
- Support staging being refreshed from production clones.
- Avoid replaying historical migrations on a database that already contains the end-state schema.
- Keep repo as the canonical source of truth going forward (new DB changes are migrations).
- Deterministic and non-interactive: commands/scripts should be safe to run in CI or by humans.

## Constraints / Risks

- Supabase CLI tracks migrations by the migration **version prefix** (filename prefix before `_`).
  Duplicate version prefixes in `supabase/migrations/` break `db push`, `db pull`, and `migration list`.
- SQL Editor changes are not automatically represented as migrations. Baseline must be done as metadata.
- `supabase db pull` / `supabase db dump` may require Docker Desktop (shadow DB) on developer machines.

## Recommended Direction

Adopt a "baseline + forward-only migrations" model:

1. After cloning production → staging, run `supabase migration repair --status applied` to mark a chosen
   set of versions as applied (metadata only). This prevents replay of historical migrations.
2. From that point forward, require all schema changes to be committed as migrations (staging-first).
3. Provide a small runbook + scripts:
   - verify unique migration versions
   - baseline up to a cutoff version
   - verify `supabase db push --dry-run` is safe before any apply
