---
task: ops-booking-email-delivery
timestamp_utc: 2026-02-05T23:11:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Booking Email Delivery Timeline

## Requirements

- Functional:
  - Ops users can view per-booking email delivery events (sent/delivered/bounced/complained/etc).
  - Events are grouped by `(messageId, recipientEmail)`.
  - Timeline shows occurred-at timestamps and subject (when available).
  - Must be read-only (no resend actions).
- Non-functional:
  - Tenant-safe: only members of the booking's restaurant can access.
  - No secrets in logs/responses.
  - UI must handle missing/unavailable delivery log without crashing.

## Existing Patterns & Reuse

- Email send: `libs/resend.ts` (returns `messageId`).
- Email delivery persistence:
  - On send: `server/emails/bookings.ts` and `server/emails/invitations.ts` call `recordEmailDeliveryLog(...)`.
  - On webhook: `src/app/api/webhook/resend/route.ts` records webhook events into `email_delivery_log`.
- Delivery log access helper: `server/emails/email-delivery-log.ts`.
- Ops auth/membership:
  - Session + membership guards: `server/auth/guards.ts`.
  - Route handler patterns under `src/app/api/ops/**`.

## Constraints & Risks

- `email_delivery_log` may not be queryable in some environments (missing table, PostgREST schema cache, or permissions).
  - Plan: treat as `503 DELIVERY_LOG_UNAVAILABLE` and render a safe UI fallback.

## Open Questions (owner, due)

- None for implementation; follow the decision-complete plan.
