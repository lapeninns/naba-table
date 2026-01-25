# Continuity Ledger

Last updated: 2026-01-25T20:30:02Z

## Goal (incl. success criteria)

- Fix high and low risk findings from parallel review
- Success: no email queue starvation, rollback does not clobber unrelated list updates, empty state preserved during refetch, and null-time handling avoids crash without changing ordering/urgency unexpectedly

## Constraints/Assumptions

- Follow AGENTS.md policies (root + nearest per file)
- Supabase remote-only; no local migrations
- Chrome DevTools MCP manual QA required for UI changes (if shipping)

## Key decisions

- Address only high and low risks; defer medium unless asked

## State

- Implementing fixes for high/low risks

## Done

- Collected AGENTS.md policies for root, components, src/components, src/app, src/hooks, server
- Captured git status for modified files
- Completed parallel reviews and identified high/low risks

## Now

- Plan and implement fixes for high/low risks

## Next

- Re-review diffs and summarize changes

## Open questions (UNCONFIRMED if needed)

- None yet

## Working set (files/ids/commands)

- `components/dashboard/BookingsTable.tsx`
- `components/dashboard/OpsBookingCard.tsx`
- `server/ops/bookings.ts`
- `src/app/api/cron/process-emails/route.ts`
- `src/app/api/ops/bookings/[id]/*/route.ts`
- `src/components/features/bookings/OpsBookingsClient.tsx`
- `src/components/features/dashboard/BookingsList.tsx`
- `src/components/features/dashboard/OpsDashboardClient.tsx`
- `src/hooks/ops/useOpsBookingStatusActions.ts`
- `src/hooks/ops/useOpsBookingsList.ts`
- `src/hooks/ops/useOpsBookingsTableState.ts`
- `src/hooks/ops/useOpsTodaySummary.ts`
