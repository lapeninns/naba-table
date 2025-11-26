---
task: reset-zones-seed
timestamp_utc: 2025-11-26T00:23:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm target environment (staging vs production) and Supabase connection URL.
- [ ] Take/verify backup or PITR snapshot availability.

## Core

- [ ] (Optional) Run `psql "$SUPABASE_DB_URL" -f supabase/utilities/reset-for-waterbeach.sql` for a full truncate.
- [ ] Run `psql "$SUPABASE_DB_URL" -f supabase/seeds/white-horse-service-periods.sql` to reseed zones, allowed capacities, and table_inventory for the Waterbeach slug.

## Verification

- [ ] Query counts per zone/mobility to confirm they match the requested layout.
- [ ] Smoke test a booking flow in staging.

## Notes

- Assumptions: target restaurant slug remains `white-horse-pub-waterbeach`; remote DB access available.
- Deviations: no code changes required; delivering runbook-style seed instructions only.
