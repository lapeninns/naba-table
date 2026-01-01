---
task: ops-booking-optional-contact
timestamp_utc: 2026-01-01T11:43:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops booking optional email/phone

## Objective

Enable ops admins to create bookings with email-only, phone-only, or both, while requiring at least one valid contact method.

## Success Criteria

- [ ] Ops booking accepts email-only, phone-only, or both.
- [ ] Validation errors are clear when both contact fields are missing or invalid.
- [ ] Downstream reservation parsing tolerates missing email/phone without throwing.

## Architecture & Components

- Ops booking API validation: `src/app/api/ops/bookings/schema.ts` (retain "at least one contact" rule).
- Reservation parsing/shape: `reserve/entities/reservation/reservation.schema.ts` + `reserve/entities/reservation/adapter.ts`.
- Optional: storage normalization in `src/app/api/ops/bookings/route.ts` to avoid empty string emails.

## Data Flow & API Contracts

Endpoint: `POST /api/ops/bookings`
Request: { email?: string | null, phone?: string | null, ... }
Response: booking DTO/reservation payload
Errors: validation issues mapped to field paths `email`/`phone` and returned as 400.

## UI/UX States

- Form allows email/phone blank individually; both missing -> field errors on both.
- Existing error focus behavior in Details step preserved.

## Edge Cases

- Email missing but phone present (valid) should pass.
- Phone missing but email present (valid) should pass.
- Both missing should block and show errors.
- Email/phone provided but invalid should show existing format errors.

## Testing Strategy

- Update/extend unit tests around reservation schema parsing if present.
- Validate ops booking flow manually; ensure no "Invalid email address" error when email absent.
- Accessibility: maintain focus management and error labeling.

## Rollout

- Feature flag: N/A
- Exposure: N/A
- Monitoring: Existing ops logs for booking creation
- Kill-switch: N/A

## DB Change Plan (if applicable)

- N/A (no migration planned)
