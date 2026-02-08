---
task: staging-perf-dataset
timestamp_utc: 2026-02-07T16:47:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan: Staging Performance-Representative Dataset

## Objective

Create a non-sensitive but production-shaped staging dataset so DB optimization work can be evidence-based (query plans, index usage, contention).

## Success Criteria

- [ ] At least **50 seed restaurants** exist with complete config tables populated (zones, inventory, service periods, hours, rules).
- [ ] Seed dataset is **identifiable** and **idempotent** (re-runs do not create duplicates by default).
- [ ] Staging has enough bookings/customers to make typical ops queries non-trivial (10k+ bookings target).
- [ ] Workload replay produces updated diagnostic artifacts under `tasks/.../artifacts/`.

## Data Model Targets (Default)

- Seed restaurants: 50
- Customers per restaurant: 250 (12,500 total)
- Bookings window: past 14 days + next 7 days (21 days)
- Bookings per restaurant per day: 15 (15,750 bookings total)
- Assignment rate: 40% of bookings get a `booking_table_assignments` row

## Safety / Guardrails

- Dry-run by default; require `--apply` to write.
- Default slug prefix: `seed-perf-rNNN` (avoids collisions with real staging restaurants).
- Default reference prefix: `SEEDPERF-<seed_tag>-<slug>-...`
- No truncation/deletion; only inserts with `ON CONFLICT DO NOTHING` where applicable.

## Implementation

1. `scripts/staging/seed-perf-dataset.ts`
   - Connect via Postgres pooler URL with `SUPABASE_DB_PASSWORD`.
   - Resolve source restaurant by slug (`SOURCE_SLUG`, default `the-old-crown-girton`).
   - Ensure seed restaurants exist; create if missing.
   - Copy config tables from source with ID remapping:
     - `allowed_capacities`
     - `restaurant_operating_hours`
     - `restaurant_service_periods`
     - `restaurant_turn_bands`
     - `zones`
     - `table_inventory`
     - `table_adjacencies` (if present)
     - `restaurant_capacity_rules`
   - Seed `customers`, `bookings`, `booking_table_assignments`.

2. `scripts/staging/replay-perf-workload.ts`
   - Run parameterized queries approximating ops list/search workloads.
   - Collect:
     - timing summary JSON
     - post-run snapshots of `extensions.pg_stat_statements`, table sizes, and scan stats

## Verification

- Count checks:
  - restaurants with slug like `seed-perf-%`
  - bookings with reference like `SEEDPERF-%`
- Spot-check:
  - `booking_table_assignments` join works (table inventory exists for restaurant)
  - sample bookings have non-null `start_at`/`end_at`
- Artifacts include snapshots and timing summaries.
