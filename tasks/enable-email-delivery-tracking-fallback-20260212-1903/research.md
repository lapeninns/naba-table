---
task: enable-email-delivery-tracking-fallback
timestamp_utc: 2026-02-12T19:04:40Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Enable Email Delivery Tracking Fallback

## Requirements

- Functional:
  - Remove false-positive Delivery tracking unavailable states when email_delivery_log exists but RPC feed functions are unavailable.
  - Keep existing API response contracts for ops email delivery feed.
- Non-functional:
  - Preserve fail-fast behavior when log storage is truly unavailable.
  - Maintain pagination and filter behavior for ops users.

## Existing Patterns & Reuse

- Primary feed path uses RPC in server/emails/email-delivery-log.ts.
- Booking-level timeline already reads from email_delivery_log directly.
- API route already tolerates missing summary by omitting summary.

## Constraints & Risks

- Fallback scans can be heavier than SQL RPC aggregation; cap scan size to avoid unbounded requests.
- If email_delivery_log is genuinely absent, fallback must still return unavailable.

## Recommended Direction

- Keep RPC as primary path.
- Add server-side direct-query fallback for list feed only when RPC returns unavailable.
- Preserve 503 unavailable semantics for true storage unavailability.
