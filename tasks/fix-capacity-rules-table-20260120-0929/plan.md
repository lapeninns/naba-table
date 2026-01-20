---
task: fix-capacity-rules-table
timestamp_utc: 2026-01-20T09:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restore restaurant_capacity_rules

## Objective

We will restore `public.restaurant_capacity_rules` so booking RPC capacity checks succeed without runtime errors in staging and production.

## Success Criteria

- [ ] Table exists in staging and production with expected schema and indexes.
- [ ] Booking capacity query in `server/booking/serviceFactory.ts` succeeds without `relation does not exist`.
- [ ] Verification evidence captured (dry-run diff, schema checks).

## Architecture & Components

- DB migration under `supabase/migrations/` to create `restaurant_capacity_rules` and indexes.
- Add updated_at trigger (`public.update_updated_at`) and enable RLS to match existing DB patterns.

## Data Flow & API Contracts

- No API contract changes. Booking capacity reads rules by restaurant_id, filters by service_period_id/day_of_week/effective_date.

## UI/UX States

- Not applicable.

## Edge Cases

- No rules present: should fall back to max safe values.
- Rules for "all periods" / "all days" / "always active" use NULLs for service_period_id/day_of_week/effective_date.

## Testing Strategy

- SQL verification in staging/prod: table exists, columns/types, indexes.
- Application-level smoke: execute capacity query via SQL or supabase client if available.

## Rollout

- Feature flag: none.
- Apply migration to staging, verify, then production.

## DB Change Plan (if applicable)

- Target envs: staging → production (window: coordinate with maintainer).
- Backup reference: confirm existing PITR/backup before apply.
- Dry-run evidence: `tasks/fix-capacity-rules-table-20260120-0929/artifacts/db-diff.txt`.
- Backfill strategy: none (empty table means no overrides).
- Rollback plan: drop table and indexes if needed.

## Schema Notes

- Columns: id, restaurant_id, service_period_id, day_of_week, effective_date, max_covers, max_parties, created_at, updated_at.
- Nullability: service_period_id/day_of_week/effective_date nullable for \"all periods/days/always active\".
- FKs: restaurant_id -> restaurants (ON DELETE CASCADE); service_period_id -> restaurant_service_periods (ON DELETE SET NULL).
- Index: (restaurant_id, service_period_id, day_of_week, effective_date).
