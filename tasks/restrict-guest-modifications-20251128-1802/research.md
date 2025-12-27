# Research

- The guest-facing update and cancel logic for bookings is implemented in `src/app/api/bookings/[id]/route.ts`. The PUT handler processes guest updates after validating payloads and ownership, while the DELETE handler performs guest cancellations with similar checks.
- Existing safeguards include pending booking locks, ownership checks, operating hours validation, and past-time validation via `assertBookingNotInPast`. There is currently no guard preventing guest edits/cancellations when checked in or close to the start time.
- `resolveBookingStart` in the same route resolves the booking date/time from either `booking_date`/`start_time` or `start_at`, which can be reused to evaluate proximity to the scheduled start.
- Tests for these endpoints live in `src/app/api/bookings/[id]/route.test.ts`, covering pending lock behavior and past booking rejection for cancellations.
