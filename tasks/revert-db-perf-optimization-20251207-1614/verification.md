---
task: revert-db-perf-optimization
timestamp_utc: 2025-12-07T16:14:47Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (database-only change; no UI impact).

## DB Validation

- Before snapshot: `artifacts/indexes-before.txt` captured against `aws-1-eu-north-1.pooler.supabase.com` using pooler URL from `supabase link`.
- After snapshot: `artifacts/indexes-after.txt`.
- Results: `idx_bookings_active_window` and `booking_table_assignments_table_window_idx` no longer present; `bookings_customer_id_idx`, `idx_allocations_restaurant`, and `idx_allocations_window_gist` restored.

## Test Outcomes

- No app tests required; schema only.

## Artifacts

- `artifacts/indexes-before.txt`
- `artifacts/indexes-after.txt`
- `artifacts/revert-commands.log`

## Known Issues

- None observed.

## Sign-off

- [ ] Engineering
- [ ] QA
