---
task: revert-db-perf-optimization
timestamp_utc: 2025-12-07T16:14:47Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Load staging DB credentials from `.env.local` without logging secrets (via `supabase link` to resolve pooler host).
- [x] Snapshot current relevant indexes (`pg_indexes`) to `artifacts/indexes-before.txt`.

## Core

- [x] Drop `idx_bookings_active_window` (CONCURRENTLY, IF EXISTS).
- [x] Drop `booking_table_assignments_table_window_idx` (CONCURRENTLY, IF EXISTS).
- [x] Create `idx_allocations_window_gist` (CONCURRENTLY, IF NOT EXISTS).
- [x] Create `idx_allocations_restaurant` (CONCURRENTLY, IF NOT EXISTS).
- [x] Create `bookings_customer_id_idx` (CONCURRENTLY, IF NOT EXISTS).

## Verification

- [x] Snapshot indexes after revert to `artifacts/indexes-after.txt` and confirm success criteria.

## Notes

- Assumptions: `.env.local` points to staging; no concurrent schema changes.
- Deviations: `supabase link` created `supabase/.temp` to resolve the correct pooler host (no secrets stored).

## Batched Questions

- None.
