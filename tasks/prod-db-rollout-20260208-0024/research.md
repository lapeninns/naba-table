---
task: prod-db-rollout
timestamp_utc: 2026-02-08T00:24:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Production DB Rollout (Baseline + Forward-Only)

## Goal

Roll out the vetted staging migrations to **production** safely, using the agreed model:

- **Option A**: baseline remote migration history (metadata only) + apply forward-only migrations via Supabase CLI.

## Target

- Production Supabase project ref (from `.env.vercel-production`): `vrdiqfudmwydclqpydee`
- Staging Supabase project ref: `ndxmivcrehsacuerwxtm`

## What Is Being Rolled Out

- Security hardening + index hygiene migration:
  - `supabase/migrations/20260207144113_rls_hardening_internal_tables.sql`
- Remaining FK index coverage migration:
  - `supabase/migrations/20260207170000_add_remaining_fk_indexes.sql`

## Risks / Why This Is High Risk

- RLS/grants changes can break unexpected client paths if any exist.
- Non-CONCURRENT index builds can lock tables during creation on large datasets.
- Loyalty removal is destructive if any production dependencies remain.

## Preconditions (Manual / Ops)

- Confirm PITR/backup readiness in Supabase dashboard for production.
- Apply in a change window (recommended) due to index DDL and potential locks.
