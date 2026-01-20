---
task: fix-capacity-rules
timestamp_utc: 2026-01-20T10:16:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix capacity rules table missing

## Objective

We will restore the missing `restaurant_capacity_rules` table in production so that booking creation via `create_booking_with_capacity_check` succeeds.

## Success Criteria

- [ ] Table exists in production with correct schema and constraints
- [ ] RPC no longer errors with `relation "restaurant_capacity_rules" does not exist`

## Architecture & Components

- Database: `restaurant_capacity_rules` table
- RPC: `create_booking_with_capacity_check`
  - Depends on `capacity_override_type` enum and `update_updated_at()` trigger

## Data Flow & API Contracts

- Existing RPC should read from `restaurant_capacity_rules`

## UI/UX States

- N/A

## Edge Cases

- Existing bookings when table is created (no backfill required)
- Empty rules for restaurants (RPC defaults should handle)
- Missing enum type or trigger function in production

## Testing Strategy

- SQL validation (table existence, constraints, RLS enabled)
- Smoke test RPC call in production (safe, non-destructive)

## Rollout

- Apply migration to production (per user request)
- Monitor errors on booking API

## DB Change Plan (if applicable)

- Target envs: production (user requested)
- Backup reference: <to confirm>
- Dry-run evidence: `artifacts/db-diff.txt`
- Backfill strategy: none
- Rollback plan: drop table + enum if created, remove policies/trigger/index
- Deviation: staging-first is bypassed per user request; document in verification.

### Proposed DDL (from backup)

- Create enum `public.capacity_override_type` if missing.
- Create table `public.restaurant_capacity_rules` with:
  - Columns: id (uuid), restaurant_id (uuid), service_period_id (uuid), day_of_week (smallint), effective_date (date), max_covers (int), max_parties (int), notes (text), created_at/updated_at (timestamptz), label (text), override_type (capacity_override_type)
  - Constraints: non-negative checks; scope check (at least one of service_period_id/day_of_week/effective_date)
  - PK: id; FKs to `restaurants` and `restaurant_service_periods` (cascade delete)
  - Index: `idx_restaurant_capacity_rules_scope` on restaurant_id + day_of_week + effective_date
  - Trigger: `restaurant_capacity_rules_updated_at` BEFORE UPDATE using `update_updated_at`
  - RLS: enabled; policies for staff + service_role
  - Grants: select/insert/delete/update for `service_role` and `authenticated`
