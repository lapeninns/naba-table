---
task: lint-get-reservation
timestamp_utc: 2025-11-24T15:34:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix ESLint any in getReservation

## Objective

Eliminate the `any` generic in `GetReservationOptions.supabase` by using the typed Supabase client while keeping the API identical for callers.

## Success Criteria

- [ ] `pnpm eslint server/reservations/getReservation.ts --max-warnings=0` passes.
- [ ] No changes to runtime logic or function signature shape aside from stronger typing.

## Architecture & Components

- File: `server/reservations/getReservation.ts`.
- Change: adjust `SupabaseClient` generic to use `Database` instead of `any` for the public schema.

## Data Flow & API Contracts

- No data flow or contract changes; only type tightening.

## UI/UX States

- Not applicable.

## Edge Cases

- Ensure the type still accepts the existing client instances (should be compatible with `SupabaseClient<Database>` throughout repo).

## Testing Strategy

- Lint: `pnpm eslint server/reservations/getReservation.ts --max-warnings=0`.

## Rollout

- Direct merge after lint passes.

## DB Change Plan

- Not applicable.
