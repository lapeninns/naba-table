# Booking Conflict Query & Index Notes

## Why these indexes

- `bookings_table_date_start_idx` supports per-table conflict scans by `table_id`, `booking_date`, `start_time`, enabling index-only lookups for the allocation workflow. The migration `database/migrations/003_add_booking_indexes.sql` creates it in a regular transaction for Supabase compatibility; use `scripts/db/booking-indexes-concurrent.sql` when you need `CREATE INDEX CONCURRENTLY` (e.g., production) ahead of the migration plane.
- `bookings_restaurant_contact_idx` accelerates duplicate detection when checking the same diner (restaurant + email + phone) during submission and anti-dupe sweeps. The manual script mirrors the same definition so you can opt into concurrent builds without code changes.
- Both indexes include frequently read columns so the executor can satisfy the query directly from the index on hot paths.

## Batch conflict SQL (shared script)

The canonical benchmark lives in `scripts/perf/booking-conflict-benchmark.sql`. It:

- Accepts positional parameters via `psql -v` for restaurant, time window, party size, seating preference, and optional ignore-id.
- Returns the overlapping bookings for every eligible table ordered by capacity.
- Re-runs the same statement under `EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML)` when `-v explain_only=1` is passed.

### Running the benchmark

```bash
psql "$DATABASE_URL" \
  -v restaurant_id='39cb1346-20fb-4fa2-b163-0230e1caf749' \
  -v booking_date='2025-03-01' \
  -v start_time='19:00' \
  -v end_time='21:00' \
  -v party_size='4' \
  -v seating_preference='any' \
  -v candidate_limit='64' \
  -f scripts/perf/booking-conflict-benchmark.sql
```

To capture the execution plan only:

```bash
psql "$DATABASE_URL" \
  -v restaurant_id='39cb1346-20fb-4fa2-b163-0230e1caf749' \
  -v booking_date='2025-03-01' \
  -v start_time='19:00' \
  -v end_time='21:00' \
  -v party_size='4' \
  -v seating_preference='any' \
  -v candidate_limit='64' \
  -v explain_only='1' \
  -f scripts/perf/booking-conflict-benchmark.sql > staging-conflict-plan.yml
```

## Verification checklist

1. Run `ANALYZE` on `public.bookings` and `public.restaurant_tables` after seeding realistic data.
2. Ensure `EXPLAIN` shows an index scan on `bookings_table_date_start_idx` (look for `Index Scan using bookings_table_date_start_idx`).
3. Confirm wall clock timing remains under **20ms P95** on staging by running the benchmark 30–50 times (psql `\watch 1` works) and aggregating `Time:` lines.
4. Capture the resulting YAML plan and add to `docs/database/plans/<date>-booking-conflict.yml` for posterity.

## Notes & Pitfalls

- The index includes `status`; update the blocking status list in the script if new lifecycle states are added to the enum.
- If measuring locally, disable parallelism (`SET max_parallel_workers_per_gather = 0`) to mirror Supabase defaults, or document differences.
- The contact index assumes both email and phone are provided; if that changes, add partial indexes for whichever identifier becomes optional.
- Keep `VACUUM (ANALYZE)` part of the perf test harness to avoid stale stats.
