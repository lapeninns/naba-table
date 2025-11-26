---
task: reset-zones-seed
timestamp_utc: 2025-11-26T00:23:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Reset zones & tables for Waterbeach

## Objective

Enable ops to reset zone/table data for the White Horse Pub (Waterbeach) to the provided layout using the existing seed scripts.

## Success Criteria

- Zones and tables in the target environment match the requested counts and mobility breakdown.
- No FK violations during reset; bookings/table assignments cleared appropriately.

## Architecture & Components

- SQL seeds: `supabase/utilities/reset-for-waterbeach.sql` (full truncate) and `supabase/seeds/white-horse-service-periods.sql` (targeted reseed for slug lookup).
- Data tables involved: `zones`, `allowed_capacities`, `table_inventory`, `booking_table_assignments` (cleanup), and dependent booking tables if full reset is chosen.

## Data Flow & Steps

1. Optional full reset: run `reset-for-waterbeach.sql` to truncate domain tables while keeping `auth.users`.
2. Apply `white-horse-service-periods.sql` to delete/reinsert zones, allowed capacities, and table_inventory rows for the slug `white-horse-pub-waterbeach`.
3. Verify row counts and sample mobility values via SELECTs.

## UI/UX States

- N/A (seed operation only).

## Edge Cases

- Slug mismatch: seed will no-op if slug changes; adjust WHERE clause accordingly.
- Existing bookings referencing tables: targeted seed deletes `booking_table_assignments` first to avoid FK errors; full reset truncates bookings entirely.

## Testing Strategy

- After seeding, run SELECT count/group queries to confirm table counts per zone and mobility.
- Smoke test booking creation in staging (out of scope here; note in verification).

## Rollout

- Run in staging first; confirm counts; then production during a maintenance window if required.
- No feature flag involved.

## DB Change Plan

- Remote-only execution via psql pointed at target Supabase instance.
- Backups: ensure PITR/snapshot available before production run (ops-controlled).
- Scripts are idempotent for the target slug (delete then insert), safe for repeated runs.
