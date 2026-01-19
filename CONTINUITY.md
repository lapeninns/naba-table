# Continuity Ledger

Last updated: 2026-01-19T20:24:00Z

## Goal (incl. success criteria)

- Automate completing past bookings (confirmed/checked_in) nightly and trigger review-request emails.
- Success: eligible bookings auto-transition to completed and reviews are scheduled.
- Success: safe batching, logging, and cron scheduling in place.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; no coding before requirements and plan are reviewed.
- Supabase remote-only; no local DB operations.
- Secrets never in source.
- Run daily at restaurant local midnight; apply to all restaurants.
- Eligible statuses: confirmed and checked_in with end time in the past.

## Key decisions

- Schedule via Vercel cron hourly and gate by restaurant local time window (60 minutes).
- Actor ID: use restaurant membership user; fallback to first auth user; optional env override.

## State

- Phase 3 (Implementation) complete; Phase 4 (Verification) pending.

## Done

- Created task folder and SDLC stubs for auto-complete automation.
- Confirmed: local midnight schedule; statuses confirmed + checked_in; permanent automation.
- Updated research/plan/todo with confirmed requirements.
- Added auto-complete job + cron endpoint and hourly Vercel cron with local-midnight window.

## Now

- Awaiting verification runs (staging dry-run/apply) and verification.md updates.

## Next

- Run staging dry-run/apply and log outputs in artifacts + verification.md.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- tasks/auto-complete-past-bookings-20260119-1944/research.md
- tasks/auto-complete-past-bookings-20260119-1944/plan.md
- tasks/auto-complete-past-bookings-20260119-1944/todo.md
- tasks/auto-complete-past-bookings-20260119-1944/verification.md
- server/jobs/auto-complete-bookings.ts
- src/app/api/cron/auto-complete-bookings/route.ts
- vercel.json
