---
task: weekend-afternoon-booking-500
timestamp_utc: 2026-03-23T11:27:26Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Weekend afternoon public booking failure

## Requirements

- Functional:
  - Public bookings on Saturday/Sunday around 15:00-17:00 must not fail due to a mismatched service label.
  - The canonical booking flow must derive booking type from the restaurant schedule slot when available.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the fix scoped to the canonical flow; no schema changes.
  - Preserve deterministic validation and existing API contracts.

## Existing Patterns & Reuse

- Public booking POST route loads `getRestaurantSchedule()` and validates the selected slot before booking creation.
- The reservation wizard plan step already infers booking type from schedule slots through `useTimeSlots()`.
- `buildReservationDraft()` currently re-infers `bookingType` from generic time windows instead of preserving the selected schedule-backed value.

## External Resources

- N/A

## Constraints & Risks

- Production still defaults `FEATURE_BOOKING_VALIDATION_UNIFIED` to false, so the legacy capacity RPC path is still active for public bookings.
- Weekend 15:00-17:00 is a boundary area where generic lunch/dinner inference can diverge from restaurant-specific service periods.

## Open Questions (owner, due)

- Q: Is the observed 500 always on the legacy RPC path, or are some cases surfaced as generic client failures for 4xx responses?
  A: UNCONFIRMED (owner: github:@amanshresthaa, due: 2026-03-23)

## Recommended Direction (with rationale)

- Preserve the booking type selected from the schedule in the reservation draft.
- In `POST /api/bookings`, canonicalize `bookingType` from the matched schedule slot before duration calculation and booking creation so client drift cannot trigger weekend boundary failures.
