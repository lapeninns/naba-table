---
task: fix-build-typecheck
timestamp_utc: 2026-02-08T01:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix build/typecheck failures

## Problem Statement

`pnpm run build` fails during TypeScript compile. Root causes identified:

- Supabase generated types (`types/supabase.ts`) are out of date relative to the canonical SQL migrations under `supabase/migrations/**`.
- Supabase typegen models `apply_booking_state_transition` RPC args/returns as non-null `string`, but domain logic legitimately passes `null` (e.g. no-show clears timestamps).
- Several local code issues surfaced by `tsc --noEmit`:
  - passing `null` to optional RPC args (should be omitted/`undefined`)
  - seed script selecting/inserting `zones.area_type` even though the column does not exist
  - audit insert payload typed as `Record<string, unknown>` instead of Supabase `Json`
  - restaurant DTOs mapping nullable DB column `reservation_lifecycle_grace_minutes` into non-null DTO fields
  - routes referencing missing relation/RPCs (`current_bookings`, `get_guest_bookings`) in the generated types

## Repro

Command:

- `pnpm run build`

Observed failure (from terminal output):

- `./scripts/backfill-review-emails.ts:213:5` TS2322: `Type 'string | null' is not assignable to type 'string'` for `p_checked_in_at`.

Command:

- `./node_modules/.bin/tsc --noEmit`

Observed failures include (non-exhaustive):

- `scripts/backfill-review-emails.ts(213,5)` / `(214,5)` / `(218,5)` nullability mismatch for apply_booking_state_transition args.
- multiple API/job callers of `apply_booking_state_transition` with same nullability mismatch.
- `server/capacity/table-assignment/soft-holds.ts` RPC name union mismatch (missing soft-hold RPCs in generated types).
- `src/app/api/bookings/route.ts` references missing RPC `get_guest_bookings` and missing relation `current_bookings`.
- `scripts/staging/smoke-email-delivery-rpc.ts` and `server/emails/email-delivery-log.ts` pass `null` to optional RPC args.
- `scripts/seed-railway-from-cornerhouse.ts` references `zones.area_type`.
- `server/occasions/admin.ts` audit insert JSON typing mismatch.
- restaurant DTO mappings return nullable values into non-null `reservationLifecycleGraceMinutes`.

## Constraints

- Supabase is remote-only.
- Staging first.
- No destructive deletes/moves without explicit request.
