# Design & Architecture Notes

**Status:** Active
**Last Updated:** 2025-11-21

## 1. Terminology Standards

### "Booking" vs "Reservation"

**Decision:** Use **"Booking"** as the primary term for the domain entity, URL, and user-facing management interfaces.

- **Rationale:**
  - **Codebase Consistency:** The existing codebase uses "Booking" (e.g., `useBookings`, `/bookings` API) approximately 10x more frequently than "Reservation".
  - **Simplicity:** "Booking" is shorter and clearer for mobile UI labels.
  - **URL Structure:** `/bookings` is a standard RESTful plural resource.

**Guidelines:**

- **URLs:** Always use `/bookings` or `/restaurants/[slug]/book`.
  - _Correct:_ `/bookings/123`
  - _Incorrect:_ `/reservations/123`, `/reserve/123`
- **UI Copy:**
  - "Your Bookings"
  - "Manage Booking"
  - "Book a Table" (Action)
- **Exceptions:**
  - It is acceptable to use "Reserve" as a verb in marketing copy (e.g., "Reserve your spot today"), but the underlying action and object should remain "Booking".

## 2. Routing & Canonicalization

See `docs/routes-guest-facing.md` for the detailed routing specification.

- **Auth:** Single entry point at `/auth/signin`.
- **Discovery:** Single entry point at `/restaurants`.
