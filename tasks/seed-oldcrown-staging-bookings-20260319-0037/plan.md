---
task: seed-oldcrown-staging-bookings
timestamp_utc: 2026-03-19T00:37:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Seed past, present, and future staging bookings

## Objective

We will seed a small representative set of synthetic bookings for `The Old Crown Girton` in staging so the environment contains past, present, and future reservation data for testing.

## Success Criteria

- [ ] Past-day bookings inserted.
- [ ] Present-day bookings inserted.
- [ ] Future-day bookings inserted.
- [ ] Verification query confirms the inserted rows.

## Architecture & Components

- `scripts/generate-bookings-safe.ts`: canonical seed path.
- Verification via direct read query against staging Supabase REST endpoints.

## Testing Strategy

- Run the seed script three times with explicit env vars.
- Query counts for the seeded dates.
