---
task: booking-capacity-precheck
timestamp_utc: 2026-04-13T13:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Implementation Plan: Booking Capacity Pre-Check

## Objective

We will enable guest booking creation to fail fast on unavailable slots so that guests get alternatives immediately and the route avoids unnecessary booking-persistence work.

## Success Criteria

- [ ] `POST /api/bookings` returns `409` with alternative slots when pre-check capacity is unavailable.
- [ ] Atomic post-precheck capacity conflicts also return a stable guest-facing `409`.
- [ ] Shared capacity availability logic is no longer a stub for the booking route path.

## Architecture & Components

- `server/capacity/service.ts`: canonical shared availability + alternative-slot evaluation.
- `src/app/api/bookings/route.ts`: guest booking route integration for pre-check and conflict responses.
- `tests/server/*`: focused route tests for pre-check and race-conflict behavior.

## Data Flow & API Contracts

Endpoint: `POST /api/bookings`
Request: existing guest booking payload
Response on capacity failure:

- `status: 409`
- `code: "CAPACITY_EXCEEDED"` or `code: "BOOKING_CONFLICT"` on the non-unified path
- alternative slots in the same `{ time, available, utilizationPercent }` shape as `/api/availability`

## UI/UX States

- Guest booking clients should receive a direct capacity failure with suggested alternatives rather than a generic failure after the full create attempt.

## Edge Cases

- Idempotent retries for an already-created booking should not be blocked by the new pre-check.
- Capacity-service lookup failures should not create false negatives; the atomic insert remains the last line of defense.
- Unified validation failures that collapse to capacity errors should still include alternatives.

## Testing Strategy

- Unit/integration:
  - public booking route returns early on pre-check failure
  - public booking route maps atomic `BOOKING_CONFLICT` to `409` with alternatives
- Browser/a11y:
  - not applicable if this remains a route-only/server-only change

## Rollout

- Feature flag: existing `bookingValidationUnified` branch remains supported.
- Exposure: immediate for the canonical guest booking route.
- Monitoring: existing booking creation observability plus added capacity-failure logging.
- Kill-switch: revert route pre-check wiring if guest create failures regress.

## DB Change Plan (if applicable)

- No schema or migration changes.
