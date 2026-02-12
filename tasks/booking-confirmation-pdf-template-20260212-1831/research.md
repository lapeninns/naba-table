---
task: booking-confirmation-pdf-template
timestamp_utc: 2026-02-12T18:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Confirmation PDF Template

## Requirements

- Functional:
- Generate a real PDF confirmation template with booking ref, guest name, date/time, party size, venue, status, notes, and branding.
- Keep download endpoint behavior for both authenticated and session-recovery access.

- Non-functional (a11y, perf, security, privacy, i18n):
- Authorization unchanged and strict at API boundary.
- Avoid adding unnecessary dependencies.
- Stable fallback values when optional fields are missing.

## Existing Patterns & Reuse

- Route: `src/app/api/reservations/[id]/confirmation/route.ts` already validates auth/session-recovery ownership.
- Restaurant fields available: `name`, `address`, `timezone`.
- Booking fields available: `reference`, `customer_name`, `start_at`, `booking_date`, `start_time`, `party_size`, `status`, `notes`.

## External Resources

- No external libraries required for this implementation.

## Constraints & Risks

- PDF text must be escaped/sanitized to avoid malformed streams.
- Missing restaurant row should not block download; use fallbacks.
- Unicode beyond simple Latin may need safe normalization fallback.

## Open Questions (owner, due)

- Q: Should logo image be embedded?
  A: Not required for this pass; branding via styled header/title is sufficient.

## Recommended Direction (with rationale)

- Replace static base64 buffer with deterministic dynamic PDF builder in `server/reservations/confirmation-pdf.ts`.
- Keep a single source of formatting/business rules inside builder helpers.
- Update API route to fetch booking + venue fields and pass into builder.
