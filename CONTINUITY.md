# Continuity Ledger

Last updated: 2026-02-08T21:03:49Z

## Goal (incl. success criteria)

- Resolve ops UI regressions and Vercel serverless function size failures.
- Success: canonical status labels, safe origin handling, timezone-stable calendar, functional filter button, visible skeleton divider, and Vercel build passes size checks.

## Constraints/Assumptions

- Follow root + path-level AGENTS policies.
- Supabase is remote-only (no local migrations).
- UI changes require DevTools MCP QA (not run yet).
- Use trusted env vars for origins (no forwarded headers).
- Do not delete or move artifacts without explicit user request.

## Key decisions

- Centralize trusted origin selection in `lib/site-url.ts`.
- Exclude `tasks/**/artifacts/**` from Vercel build context and Next tracing.
- Derive calendar selection dates from restaurant date parts to avoid drift.
- Make filter button scroll to the filters bar instead of remaining inert.

## State

- Code fixes applied; pending verification and Vercel build confirmation.

## Done

- Created task `tasks/fix-ops-ui-issues-20260208-2049/` with Phase docs.
- Created task `tasks/fix-vercel-function-size-20260208-2102/` with Phase docs.
- Updated `lib/site-url.ts` with trusted origin helpers.
- Removed header-derived origin usage in server-side prefetches.
- Fixed status label resolution in booking details utils.
- Adjusted heatmap calendar date construction to avoid timezone drift.
- Wired filter button to scroll to the filters bar.
- Fixed skeleton divider visibility class.
- Added `outputFileTracingExcludes` and `.vercelignore` for task artifacts.

## Now

- Summarize changes for user and request Vercel rebuild confirmation.

## Next

- Update verification notes after Vercel build result.
- Run DevTools MCP QA if requested.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/site-url.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/next.config.js
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/.vercelignore
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/booking-details/utils.ts
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/HeatmapCalendar.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/OpsDashboardToolbar.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/cards/OpsBookingCardSkeleton.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/app/(app)/dashboard/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/bookings/[bookingId]/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/bookings/booking-page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/guest/bookings/[bookingId]/receipt/page.tsx
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-ops-ui-issues-20260208-2049/\*
- /Users/amankumarshrestha/LapenInns Project/SajiloReserveX/tasks/fix-vercel-function-size-20260208-2102/\*
