---
task: booking-capacity-precheck
timestamp_utc: 2026-04-13T13:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Research: Booking Capacity Pre-Check

## Requirements

- Functional:
  - `POST /api/bookings` must check capacity before attempting booking persistence.
  - When a requested slot has no capacity, the guest response must include alternative slots.
  - Capacity race outcomes during the atomic insert path must still return a stable guest-facing `409` response.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI surface changes are expected for this task.
  - Keep the hot booking path lean and reuse shared booking/capacity logic.
  - Do not expose raw database errors in guest responses.

## Existing Patterns & Reuse

- `src/app/api/bookings/route.ts` already uses `createBookingWithCapacityCheck` as the atomic persistence step, but only after substantial route work.
- `src/app/api/bookings/route-v2-with-capacity.ts.draft` documents the intended behavior:
  - pre-check capacity
  - return alternatives
  - handle `CAPACITY_EXCEEDED` and `BOOKING_CONFLICT` explicitly
- `src/app/api/availability/route.ts` already defines the public alternative-slot response shape to reuse.
- `server/booking/serviceFactory.ts` contains real capacity-check logic for the unified validation service.
- `server/capacity/service.ts` is still a stub, so shared availability checks and alternatives are not yet real.

## External Resources

- None required beyond repo-local code and draft guidance for this fix.

## Constraints & Risks

- Early pre-checking can break idempotent retries if it rejects before the route can recognize an already-created booking.
- The non-unified and unified creation branches must both preserve stable behavior.
- The route currently contains a direct insert fallback when RPC recovery fails; this change should not widen that path.

## Open Questions (owner, due)

- Q: How early can capacity be checked without breaking deterministic idempotency/retry behavior?
  A: Preserve customer/idempotency resolution first, then pre-check before the atomic create step.

## Recommended Direction (with rationale)

- Implement real shared availability logic in `server/capacity/service.ts` so both the availability endpoint and booking route use the same capacity view.
- Add a pre-check to `POST /api/bookings` after customer/idempotency resolution but before `createBookingWithCapacityCheck`.
- Reuse the same alternative-slot format already exposed by `/api/availability`.
- Treat post-precheck `CAPACITY_EXCEEDED` and `BOOKING_CONFLICT` outcomes as guest-facing `409`s with alternatives, because those represent race-safe atomic failures rather than internal server errors.
