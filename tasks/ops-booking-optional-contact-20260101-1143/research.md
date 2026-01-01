---
task: ops-booking-optional-contact
timestamp_utc: 2026-01-01T11:43:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops booking optional email/phone

## Requirements

- Functional:
  - Ops admin can create bookings with email only, phone only, or both.
  - At least one contact method must be present; both missing should be blocked with a clear error.
  - If provided, email/phone must pass existing validation rules.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing form accessibility and error focus behavior.
  - Keep validation at system boundaries; avoid redundant checks in deeper layers.

## Existing Patterns & Reuse

- API validation: `src/app/api/ops/bookings/schema.ts` already treats email/phone as optional and enforces “at least one contact method.”
- Form validation (ops mode): `reserve/features/reservations/wizard/model/schemas.ts` uses `createDetailsFormSchema(mode)` where `mode === 'ops'` skips required errors for empty email/phone.
- Reservation parsing: `reserve/entities/reservation/reservation.schema.ts` currently requires `customerEmail` to be a valid email string; empty string fails.
- Reservation adapters: `reserve/entities/reservation/adapter.ts` normalizes API records; `customerEmail` is passed through as-is (can be empty string).

## External Resources

- N/A

## Constraints & Risks

- Changing reservation schema/types may affect any consumers expecting non-null email.
- Must keep ops booking API behavior aligned with “at least one contact method” rule.

## Open Questions (owner, due)

- Q: Which ops booking entry points are in scope (wizard only vs other ops forms)?
  A: UNCONFIRMED
- Q: Should phone validation remain UK-only for ops, or should ops accept international formats?
  A: UNCONFIRMED
- Q: Should missing email be stored as null (preferred) instead of empty string, and is that acceptable for downstream exports?
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Normalize missing email to null in reservation adapter and relax reservation schema to allow null when email is absent.
- Keep API boundary rule of “at least one contact method” in `opsWalkInBookingSchema`.
- If necessary, adjust server storage to avoid persisting empty string for customerEmail when not provided.
