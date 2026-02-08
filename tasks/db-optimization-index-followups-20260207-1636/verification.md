---
task: db-optimization-index-followups
timestamp_utc: 2026-02-07T16:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Staging Migration Status

- `supabase migration list --linked`: includes `20260207170000`.
- `supabase db push --linked --dry-run`: reports staging is up to date.

## FK Index Audit

- Remaining exception after apply:
  - `analytics_events.customer_id` uses `idx_analytics_events_customer_id` as a partial index (`WHERE customer_id IS NOT NULL`), which is acceptable because the FK is nullable and checks only apply to non-null values.

## Notes

- Supabase CLI migration application uses pipelined execution; `CREATE INDEX CONCURRENTLY` is not usable in migrations applied via `supabase db push`.
