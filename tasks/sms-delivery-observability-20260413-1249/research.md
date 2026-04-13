---
task: sms-delivery-observability
timestamp_utc: 2026-04-13T12:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: SMS Delivery Observability

## Requirements

- Functional:
  - Persist outbound booking SMS attempts with a provider message identifier.
  - Ingest Twilio delivery-status callbacks and update the SMS delivery trail.
  - Expose SMS delivery history to ops in a booking-level surface similar to email delivery.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Validate Twilio webhook signatures before recording callback data.
  - Avoid duplicate delivery-log rows for repeated callbacks.
  - Keep recipient phone data scoped to operational surfaces only.

## Existing Patterns & Reuse

- `server/sms/bookings.ts` already centralizes guest booking SMS sends and returns `messageSid`.
- `lib/twilio/sms.ts` owns the Twilio REST request construction.
- `server/emails/email-delivery-log.ts` is the canonical model for persisted provider delivery events, booking-level retrieval, and ops-facing summaries.
- `src/app/api/webhook/resend/route.ts` is the canonical webhook-ingestion pattern for delivery status updates.
- `src/components/features/dashboard/booking-details/components/EmailDeliveryPanel.tsx` is the local UI pattern for per-booking delivery history.

## External Resources

- Twilio webhook validation and Messaging status callbacks (official docs) were consulted for signature validation and callback semantics.

## Constraints & Risks

- No existing `sms_delivery_log` table or Twilio status-callback route exists today.
- SMS retries are riskier than email retries because duplicates are more user-visible and harder to undo, so retry is intentionally out of scope for this pass.
- DB migration will be needed; remote apply is not part of this implementation turn.

## Open Questions (owner, due)

- Q: Should this first pass include a full restaurant-wide SMS delivery dashboard or booking-level visibility plus foundational logging?
  A: Booking-level visibility plus foundational logging, using the same backend data model that can support a broader dashboard later. Owner: github:@amanshresthaa, due: 2026-04-13

## Recommended Direction (with rationale)

- Add a dedicated `sms_delivery_log` table and booking-level retrieval path.
- Log outbound SMS attempts at send time and update them from a Twilio status-callback webhook.
- Reuse the booking-details delivery panel pattern for immediate ops visibility, while keeping the data model extensible for a future restaurant-wide SMS dashboard.
