---
task: email-delivery-status
timestamp_utc: 2026-01-26T12:03:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Email Queue + Delivery Status

## Requirements

- Functional:
  - Show email queue status (waiting/delayed/failed/none) for active bookings.
  - Show sent/delivered (and failed/bounced) email events per booking/recipient.
  - Support filters by email type, status, time range.
- Non-functional:
  - Ops-only access; enforce authn/authz.
  - Capture and store delivery events reliably.
  - Use Resend webhook verification (signature validation).
  - Avoid PII exposure beyond Ops access.

## Existing Patterns & Reuse

- Queue status API + UI already implemented at `/api/ops/email-status` + `/app/email-status`.
- Email senders in `server/emails/*` and Resend client (look up existing implementation).
- Ops API patterns for auth + pagination in `src/app/api/ops/*`.

## External Resources

- Resend webhooks + Svix signature verification docs (validated 2026-01-26).

## Constraints & Risks

- Must use Supabase remote-only for schema changes.
- Manual Chrome DevTools MCP QA required for UI changes.
- Need single source of truth for email delivery logs.

## Open Questions

- None (resolved).

## Recommended Direction

- Add an `email_delivery_log` table to persist send + webhook events.
- On send: write "sent" log with booking_id, type, recipient, provider_id.
- On webhook: update or append delivery events (delivered, bounced, failed).
- Extend Ops email status UI to show both queue state + delivery state.
- Retain delivery logs for 180 days (daily cleanup cron).
