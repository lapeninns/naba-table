---
task: sms-delivery-observability
timestamp_utc: 2026-04-13T12:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: SMS Delivery Observability

## Objective

We will add Twilio-backed SMS delivery tracking for booking messages so that ops can inspect whether a booking SMS was queued, sent, delivered, or failed from the booking details workflow.

## Success Criteria

- [ ] Booking SMS sends create a `sms_delivery_log` row keyed by `message_sid`.
- [ ] Twilio status callbacks are signature-validated and update the SMS delivery trail with mapped delivery statuses.
- [ ] Ops can view SMS delivery history for a booking in the booking details surface.
- [ ] No duplicate rows are created for repeated provider callbacks.

## Architecture & Components

- Database:
  - `public.sms_delivery_log`
- Backend:
  - `server/sms/delivery-log.ts`
  - `src/app/api/webhook/twilio/sms-status/route.ts`
  - `src/app/api/ops/bookings/[id]/sms-delivery/route.ts`
  - `server/sms/bookings.ts`
  - `lib/twilio/sms.ts`
- Frontend:
  - booking-level hook + `SmsDeliveryPanel`
  - `GuestProfilePanel` integration

## Data Flow & API Contracts

- Outbound send:
  - `server/sms/bookings.ts` sends SMS through Twilio and records a `queued`/`sent` event using the returned `messageSid`.
- Callback ingest:
  - Twilio posts form-encoded status updates to `/api/webhook/twilio/sms-status`.
  - Route validates `X-Twilio-Signature` with `TWILIO_AUTH_TOKEN`.
  - Route maps provider statuses into internal statuses and appends them to `sms_delivery_log`.
- Ops read:
  - `GET /api/ops/bookings/:id/sms-delivery?limit=50`
  - Returns booking-scoped SMS delivery events.

## UI/UX States

- Loading / unavailable / API error / empty / grouped delivery history.
- Present SMS delivery alongside email delivery in booking details.

## Edge Cases

- Phone-less bookings should not create SMS log entries.
- Duplicate callbacks should be idempotent.
- Unknown provider statuses should be ignored or recorded safely without corrupting current-state grouping.

## Testing Strategy

- Unit:
  - Twilio status mapping and signature validation helpers
  - SMS delivery grouping/presentation
- Integration:
  - webhook route
  - booking SMS send logging
  - booking-level ops route
- UI:
  - panel rendering states

## Rollout

- DB migration staged first, then code deployment.
- `TWILIO_AUTH_TOKEN` must be configured before webhook ingestion is considered active.
- Manual verification:
  - send a booking SMS in staging
  - confirm `sms_delivery_log` gets an outbound row
  - trigger or observe a Twilio callback and confirm status progression
