---
task: grab-zones-tables-oldcrowngirton
timestamp_utc: 2026-02-08T15:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the production Supabase URL + service role key are available in env.
- [x] Confirm restaurant slug for Old Crown Girton in production (`RESTAURANT_SLUG`).

## Core

- [x] Implement `scripts/export-restaurant-zones-tables.ts` (read-only).
- [x] Ensure paging covers >1000 rows.
- [x] Ensure outputs are deterministic (sorted).

## Verification

- [x] Run export against production.
- [x] Record counts + basic sanity checks in `verification.md`.
- [x] Confirm no secrets are written to artifacts or stdout.
