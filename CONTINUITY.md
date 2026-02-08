# Continuity Ledger

Last updated: 2026-02-08T20:52:55Z

## Goal (incl. success criteria)

- Fix ops UI regressions and SSRF risk in server-side prefetches.
- Success: status labels use canonical ops labels; no header-derived origin usage; heatmap calendar date stable across timezones; filter button is functional; skeleton divider renders correctly.

## Constraints/Assumptions

- Follow root + path-level AGENTS policies.
- Supabase is remote-only (no local migrations).
- UI changes require DevTools MCP QA (not run yet).
- Use trusted env vars for origins (no forwarded headers).

## Key decisions

- Centralize trusted origin selection in `lib/site-url.ts`.
- Derive calendar selection dates from restaurant date parts to avoid drift.
- Make filter button scroll to the filters bar instead of remaining inert.

## State

- Code fixes applied; pending verification update and user summary.

## Done

- Created task `tasks/fix-ops-ui-issues-20260208-2049/` with Phase 1/2/3 stubs.
- Updated `lib/site-url.ts` with trusted origin helpers.
- Fixed status label resolution in booking details utils.
- Removed header-derived origin usage in server-side prefetches.
- Adjusted heatmap calendar date construction to avoid timezone drift.
- Wired filter button to scroll to the filters bar.
- Fixed skeleton divider visibility class.

## Now

- Validate changes and summarize for user.

## Next

- Update verification notes (QA/testing status).
- Run quick smoke checks if requested.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/site-url.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/booking-details/utils.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/HeatmapCalendar.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/OpsDashboardToolbar.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/cards/OpsBookingCardSkeleton.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/app/(app)/dashboard/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/bookings/[bookingId]/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/bookings/booking-page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/guest/bookings/[bookingId]/receipt/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-ops-ui-issues-20260208-2049/\*
