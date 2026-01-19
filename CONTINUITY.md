# Continuity Ledger

<<<<<<< Updated upstream
Last updated: 2026-01-19T20:34:00Z
=======
Last updated: 2026-01-19T20:40:00Z

> > > > > > > Stashed changes

## Goal (incl. success criteria)

- Automate completing past bookings (confirmed/checked_in) nightly and trigger review-request emails.
- Success: eligible bookings auto-transition to completed and reviews are scheduled.
  <<<<<<< Updated upstream
- # Success: safe batching, logging, and cron scheduling in place.
- Success: local-midnight scheduling is accurate for all timezones.
  > > > > > > > Stashed changes

## Constraints/Assumptions

- Follow AGENTS SDLC phases; no coding before requirements and plan are reviewed.
- Supabase remote-only; no local DB operations.
- Secrets never in source.
- Run daily at restaurant local midnight; apply to all restaurants.
  <<<<<<< Updated upstream
- Eligible statuses: confirmed and checked_in with end time in the past.

## Key decisions

- Schedule via Vercel cron hourly and gate by restaurant local time window (60 minutes).
- Actor ID: use restaurant membership user; fallback to first auth user; optional env override.

## State

- Fixes in progress for cron timing and cross-midnight end time handling; verification pending.

## Done

- Created task folder and SDLC stubs for auto-complete automation.
- Confirmed: local midnight schedule; statuses confirmed + checked_in; permanent automation.
- Updated research/plan/todo with confirmed requirements.
- Added auto-complete job + cron endpoint and Vercel cron with local-midnight window.

## Now

- Apply fixes: 15-minute cron cadence/window, cross-midnight end-time adjustment.

## Next

- # Run staging dry-run/apply and log outputs in artifacts + verification.md; re-review for merge.

## Key decisions

- Schedule cron every 15 minutes and gate by 15-minute local-midnight window.
- Cross-midnight end times are adjusted by +1 day when end < start.

## State

- Fixes committed; merge attempts blocked by Git lock permissions in sandbox.

## Done

- Added auto-complete job + cron endpoint.
- Committed fixes for cron cadence/window and cross-midnight end handling.

## Now

- Need user to merge branch into main and frontend-dec19 (sandbox cannot lock refs).

## Next

- Run staging dry-run/apply and log outputs in artifacts + verification.md.
  > > > > > > > Stashed changes

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

<<<<<<< Updated upstream

- tasks/auto-complete-past-bookings-20260119-1944/research.md
- tasks/auto-complete-past-bookings-20260119-1944/plan.md
- tasks/auto-complete-past-bookings-20260119-1944/todo.md
- tasks/auto-complete-past-bookings-20260119-1944/verification.md
- server/jobs/auto-complete-bookings.ts
- src/app/api/cron/auto-complete-bookings/route.ts
- # vercel.json
- server/jobs/auto-complete-bookings.ts
- src/app/api/cron/auto-complete-bookings/route.ts
- vercel.json
- tasks/auto-complete-past-bookings-20260119-1944/verification.md
  > > > > > > > Stashed changes
