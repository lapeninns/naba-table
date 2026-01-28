---
task: ops-booking-crud-email
timestamp_utc: 2026-01-28T17:28:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops booking CRUD emails

## Objective

We will send ops-initiated booking CRUD emails with copy that explicitly states the action was done on the guest’s behalf, while preserving existing guest templates.

## Success Criteria

- [ ] Ops-created bookings send ops-specific confirmation/request emails.
- [ ] Ops-updated bookings send ops-specific update/modification emails.
- [ ] Ops-cancelled bookings send ops-specific cancellation emails (wording confirmed).
- [ ] Email queue and cron/worker paths preserve actor context.
- [ ] Unit tests cover template selection for ops vs guest.

## Architecture & Components

- `server/queue/email.ts`: add `actor` to `EmailJobPayload` (guest/ops/system).
- `server/jobs/booking-side-effects.ts`: include `actor` in CRUD payloads; pass into enqueue/send paths.
- `server/emails/bookings.ts`: accept actor context and select ops-specific copy for create/update/cancel (+ modification pending/confirmed if required).
- `scripts/queues/email-worker.ts` and `src/app/api/cron/process-emails/route.ts`: pass actor to email dispatch.
- `src/app/api/ops/bookings/**` and `src/app/api/bookings/**`: set actor for CRUD enqueues.
- `server/jobs/auto-assign.ts` + `server/bookings/modification-flow.ts`: pass actor for inline emails.

## Data Flow & API Contracts

- Email job payload: `{ bookingId, restaurantId, type, actor?: 'guest' | 'ops' | 'system', scheduledFor? }`.
- Actor defaults to `guest` when omitted for backwards compatibility with existing queued jobs.

## UI/UX States

- N/A (email templates only).

## Edge Cases

- Pending -> confirmed transitions from auto-assign should keep ops copy when booking created by ops.
- Staff cancellation that is “on behalf of guest” vs “restaurant cancellation” needs clarified copy.

## Testing Strategy

- Add unit tests for email template selection (ops vs guest) in `tests/server/**`.
- Verify queue dispatch uses actor when present and falls back when missing.

## Rollout

- No feature flag unless required; monitor email queue failures/logs.

## DB Change Plan (if applicable)

- Not applicable.
