# Continuity Ledger

Last updated: 2025-12-27T07:46:20Z

## Goal (incl. success criteria)

- Make instant booking emails send inline even when the queue is enabled.
- Success: instant types bypass queue; scheduled types remain queued; docs updated.

## Constraints/Assumptions

- Follow AGENTS SDLC phases with task artifacts.
- No UI changes; no DB changes; no new flags.
- Secrets never in source.

## Key decisions

- Instant types: request_received, confirmation, updated, cancelled, restaurant_cancellation, booking_rejected.
- Scheduled types (reminder_24h, reminder_short, review_request) remain queued.
- Auto-assign deferral for request_received will no longer apply when queue is enabled.

## State

- Phase 3 implementation done; verification notes pending.

## Done

- Created task folder tasks/instant-email-inline-20251227-0741/ with SDLC stubs.
- Updated booking-side-effects to bypass queue for instant types.
- Updated docs/EMAIL_SYSTEM.md to reflect queue scope.

## Now

- Update verification notes and summarize changes.

## Next

- Optionally run tests.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- CONTINUITY.md
- server/jobs/booking-side-effects.ts
- docs/EMAIL_SYSTEM.md
- tasks/instant-email-inline-20251227-0741/research.md
- tasks/instant-email-inline-20251227-0741/plan.md
- tasks/instant-email-inline-20251227-0741/todo.md
- tasks/instant-email-inline-20251227-0741/verification.md
