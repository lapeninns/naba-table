---
task: seed-staging-bookings
timestamp_utc: 2026-02-05T16:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes).

## Test Outcomes

- [x] Connectivity check succeeded (Supabase MCP execute_sql).
- [x] 50 bookings inserted.
- [x] Sample query verified.

## Artifacts

- Seed log: `artifacts/seed-log.txt`
- Verification query output: `artifacts/verify-count.txt`
- Seed SQL: `artifacts/seed-bookings.sql`

## Notes

- Timezone used for 17:00–21:00 window: UTC.

## Known Issues

- [ ] None.

## Sign-off

- [ ] Engineering
