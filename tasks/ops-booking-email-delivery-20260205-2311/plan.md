---
task: ops-booking-email-delivery
timestamp_utc: 2026-02-05T23:11:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Email Delivery Timeline

## Objective

Expose a read-only email delivery timeline within the ops booking details dialog, backed by the existing Resend + webhook + `email_delivery_log` system.

## Success Criteria

- [ ] Email delivery events render in booking details (loading / empty / unavailable / error / populated).
- [ ] API enforces ops session + restaurant membership.
- [ ] Missing/unavailable log returns `503 DELIVERY_LOG_UNAVAILABLE` and UI degrades gracefully.
- [ ] Unit tests cover grouping logic.

## Architecture & Components

- API route:
  - `GET /api/ops/bookings/:id/email-delivery`
  - File: `src/app/api/ops/bookings/[id]/email-delivery/route.ts`
- Server helper:
  - `server/emails/email-delivery-log.ts` adds `listEmailDeliveryEventsForBooking(...)`
- UI:
  - `EmailDeliveryPanel` added to `GuestProfilePanel` (booking details dialog)

## Data Flow & API Contract

Request:

- `GET /api/ops/bookings/:id/email-delivery?limit=50`

Response:

- `200`: `{ ok:true, bookingId, events:[...] }`
- `401/403/404/503/500`: `{ ok:false, code, error, message }`

## Testing Strategy

- Unit: grouping helper (`groupEmailDeliveryEvents`) + edge cases.
- Manual: Chrome DevTools MCP verification in booking dialog.

## Rollout

- No feature flag.
- Safe fallback UI if delivery log is unavailable.
