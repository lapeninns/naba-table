---
task: purge-amanshrestha-email-bookings
timestamp_utc: 2026-03-24T12:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Summary

- Operation: preview and hard-delete bookings scoped to one masked guest email in production.
- Target project ref: `vrdiqfudmwydclqpydee`
- Preview matched bookings: `15`
- Remaining bookings after delete: `0`

## Commands Run

- Preview via inline Node + Supabase service-role client using `.env.vercel-production`
- Apply delete via inline Node + Supabase service-role client using `.env.vercel-production`
- Post-check via inline Node + Supabase service-role client using `.env.vercel-production`

## Outcomes

- Matched bookings spanned:
  - `the-old-crown-girton`: 14 bookings
  - `the-railway-pub`: 1 booking
- Deleted dependent rows:
  - `booking_table_assignments`: 7
  - `booking_state_history`: 20
  - `booking_assignment_attempts`: 0
  - `booking_assignment_idempotency`: 4
  - `booking_confirmation_results`: 16
  - `booking_versions`: 0
  - `analytics_events`: 17
  - `table_holds`: 0
  - `table_soft_holds`: 0
  - `email_delivery_log`: 33
  - `allocations`: 17
  - `capacity_outbox`: 48
  - `bookings`: 15
- Post-check confirmed zero remaining bookings for the masked guest email.

## Artifacts

- Preview output: `artifacts/preview.json`
- Apply output: `artifacts/apply.json`
- Post-check output: `artifacts/post-check.json`

## Notes / Risks

- PII is intentionally minimized in artifacts.
- Direct Postgres login from the saved production DB URL failed with auth error `28P01`, so execution used the working service-role path already established in repo admin scripts.
