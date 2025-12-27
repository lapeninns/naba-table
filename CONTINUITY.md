# Continuity Ledger

Last updated: 2025-12-27T07:54:30Z

## Goal (incl. success criteria)

- Make instant booking emails send inline even when the queue is enabled.
- Ensure scheduled emails enqueue successfully without jobId errors.
- Success: instant types bypass queue; scheduled types remain queued and can be added.

## Constraints/Assumptions

- Follow AGENTS SDLC phases with task artifacts.
- No UI changes; no DB changes; no new flags.
- Secrets never in source.

## Key decisions

- Instant types: request_received, confirmation, updated, cancelled, restaurant_cancellation, booking_rejected.
- Scheduled types (reminder_24h, reminder_short, review_request) remain queued.
- Sanitize email queue job IDs to remove `:` and keep removal compatible.

## State

- Implementation done; not re-verified after jobId fix.

## Done

- Updated booking-side-effects to bypass queue for instant types.
- Added jobId sanitization in email queue helper.
- Updated docs/EMAIL_SYSTEM.md for queue scope.

## Now

- Await user confirmation to run tests or re-check logs.

## Next

- Optional: trigger a booking to verify reminder jobs enqueue.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- CONTINUITY.md
- server/jobs/booking-side-effects.ts
- server/queue/email.ts
- docs/EMAIL_SYSTEM.md
- tasks/instant-email-inline-20251227-0741/research.md
- tasks/instant-email-inline-20251227-0741/plan.md
- tasks/instant-email-inline-20251227-0741/todo.md
- tasks/instant-email-inline-20251227-0741/verification.md
