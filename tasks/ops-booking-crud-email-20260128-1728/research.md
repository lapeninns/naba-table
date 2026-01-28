---
task: ops-booking-crud-email
timestamp_utc: 2026-01-28T17:28:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops booking CRUD emails

## Requirements

- Functional:
  - Ops-initiated create/update/cancel actions must send guest emails that indicate the action was done on their behalf.
  - Guest-initiated actions should continue to use existing templates.
  - Email queue and cron/worker flows must preserve the correct template variant.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI impact; no a11y changes.
  - Preserve email queue reliability and idempotency.
  - Avoid leaking staff identity in guest emails unless explicitly requested.
  - Keep payload changes backward compatible with queued jobs.

## Existing Patterns & Reuse

- Email rendering and template copy live in `server/emails/bookings.ts` via `dispatchEmail()` and `resolveTemplate()`.
- Email queue payload types live in `server/queue/email.ts` and are processed by:
  - `scripts/queues/email-worker.ts`
  - `src/app/api/cron/process-emails/route.ts`
- Booking side effects enqueue CRUD emails in `server/jobs/booking-side-effects.ts`.
- Ops booking routes:
  - Create: `src/app/api/ops/bookings/route.ts` (walk-in source + details)
  - Update/cancel: `src/app/api/ops/bookings/[id]/route.ts`
- Guest booking routes:
  - Create: `src/app/api/bookings/route.ts`
  - Update/cancel: `src/app/api/bookings/[id]/route.ts`
- Modification flow (update with realignment) uses `server/bookings/modification-flow.ts`.
- Auto-assign job can send confirmation/modification emails: `server/jobs/auto-assign.ts`.

## External Resources

- None (internal changes only).

## Constraints & Risks

- Email job payload currently lacks actor/source; queued jobs must remain valid.
- Cancellation path distinguishes `cancelled` vs `restaurant_cancellation` by `cancelledBy`, which may not match “on behalf of guest” semantics.
- Auto-assign and modification flows send emails outside the queue; they need the same actor context for consistency.

## Open Questions (owner, due)

- Q: Which CRUD events require ops-specific templates (create/update/cancel only, or also modification pending/confirmed)?
  A: (owner: github:@amanshresthaa)
- Q: For staff cancellations done on behalf of guest, should we replace the existing “restaurant cancellation” copy?
  A: (owner: github:@amanshresthaa)
- Q: Any preferred subject/body wording for ops actions, or should we provide defaults?
  A: (owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Add an explicit email actor flag (guest/ops/system) to email job payloads and side-effect payloads to drive template selection.
- Update `dispatchEmail`/`sendBooking*` functions to accept actor context and use ops-specific copy for create/update/cancel (and modification templates if needed).
- Propagate actor from ops/public routes and auto-assign/modification flows to keep queued and inline sends consistent.
- Keep reminders/review emails unchanged (actor ignored).
