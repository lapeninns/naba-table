---
task: slot-logic-production-rollout
timestamp_utc: 2026-03-23T13:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA

- Not applicable; no UI changes in this rollout.

## Production Data Verification

- [x] Production built-in `lunch` and `dinner` occasion availability cleared.
- [x] Production Old Crown interval updated to `30`.

### Verified production state

- Before rollout:
  - Old Crown `reservation_interval_minutes = 15`
  - Built-in `lunch` availability: `11:30-15:30`
  - Built-in `dinner` availability: `16:00-23:00`
- After rollout:
  - Old Crown `reservation_interval_minutes = 30`
  - Built-in `lunch` availability: `[]`
  - Built-in `dinner` availability: `[]`

### Apply notes

- Repo commit pushed before live apply: `910e63bd`
- Production data updates were executed with the production service-role client because `supabase` CLI and `psql` were unavailable in this workspace.
- The built-in occasion cleanup succeeded on the first write.
- The Old Crown interval update required one retry after removing an invalid `deleted_at` filter on `public.restaurants`.

## Code Verification

- Reused previously passing slot-logic verification from the merged changes on `main`.

## Artifacts

- Before production state: `artifacts/before-production-slot-config.json`
- After production state: `artifacts/after-production-slot-config.json`

## Known Issues

- Sunday dinner still ends at `20:30` for Old Crown because the configured Sunday dinner service period ends at `21:00`.

## Sign-off

- [x] Engineering
