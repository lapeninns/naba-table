---
task: lint-get-reservation
timestamp_utc: 2025-11-24T15:34:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Capture requirements and plan for the lint fix.

## Core

- [x] Replace `SupabaseClient<Database, 'public', any>` with a typed client (no `any`) while keeping the options shape.

## Tests

- [x] Run `pnpm eslint server/reservations/getReservation.ts --max-warnings=0`.

## Notes

- Assumptions: Repo Supabase client instantiations are compatible with `SupabaseClient<Database>`.
- Deviations: None.
