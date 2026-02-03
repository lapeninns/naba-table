---
task: restaurant-turn-bands-migration
timestamp_utc: 2026-02-03T16:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Turn Bands Migration

## Objective

We will apply the `restaurant_turn_bands` migration to production if it is pending so that ops APIs can query turn bands without 500s.

## Success Criteria

- [ ] Production shows `public.restaurant_turn_bands` in migration history.
- [ ] `pnpm db:push --dry-run` shows no pending migrations after apply.

## Architecture & Components

- `supabase/migrations/20260203_add_restaurant_turn_bands.sql`: schema changes.
- Supabase CLI via `pnpm db:push` for remote apply.

## Data Flow & API Contracts

- No API changes; schema supports `/api/ops/restaurants/:id/turn-bands` reads/writes.

## UI/UX States

- N/A (DB-only change).

## Edge Cases

- Migration already applied; no action required.
- Missing/invalid DB URL prevents apply.

## Testing Strategy

- `supabase db push --dry-run` to confirm pending status.
- Optional post-check: query schema table list (if available) via `supabase migration list`.

## Rollout

- Change window: immediate.
- Monitoring: observe ops API 500s after apply.

## DB Change Plan (if applicable)

- Target envs: staging → production (window: immediate)
- Backup reference: confirm PITR available in Supabase dashboard.
- Dry-run evidence: `artifacts/db-diff.txt`
- Backfill strategy: none
- Rollback plan: drop table and constraints created by migration (record exact SQL from migration file).
