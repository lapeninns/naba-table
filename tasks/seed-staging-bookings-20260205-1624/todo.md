---
task: seed-staging-bookings
timestamp_utc: 2026-02-05T16:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm staging Supabase DB host/URL and password.
- [ ] Confirm booking date (2026-02-05) and dinner window 17:00–21:00.
- [ ] Confirm restaurant name (Old Crown Girton) and cleanup tagging.

## Core

- [x] Run connectivity check against staging (via Supabase MCP execute_sql).
- [x] Run seeding script with `BOOKING_COUNT=50`.
- [x] Verify 50 new bookings created.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Confirm DB host for staging (db.<project_ref>.supabase.co failed to resolve).
