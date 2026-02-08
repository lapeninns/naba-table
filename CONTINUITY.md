# Continuity Ledger

Last updated: 2026-02-08T16:42:30Z

## Goal (incl. success criteria)

- Fix guest active bookings filtering so past bookings do not remain in `/api/bookings?me=1&status=active`.
- Success: active results only include bookings with `booking_date >= today` in the restaurant timezone and pagination totals match filtered results.

## Constraints/Assumptions

- Follow root + path-level AGENTS policies.
- Supabase is remote-only (no local migrations).
- No UI change; API-only update.
- Guest booking counts are small enough for in-memory filtering (UNCONFIRMED).

## Key decisions

- Filter active bookings in `handleMyBookings` using `getTodayInTimezone` with per-row restaurant timezone (fallback `UTC`).
- Apply pagination after filtering and compute total from filtered rows for accuracy.

## State

- API change implemented; pending manual verification.

## Done

- Created task `tasks/fix-guest-active-bookings-20260208-1638/` with Phase 1/2 docs.
- Updated `handleMyBookings` to filter active bookings by restaurant-local date and paginate after filtering.

## Now

- Summarize changes and testing status for user.

## Next

- Manual check of active bookings filtering if needed.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/api/bookings/route.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/utils/datetime.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-guest-active-bookings-20260208-1638/research.md
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-guest-active-bookings-20260208-1638/plan.md
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-guest-active-bookings-20260208-1638/todo.md
