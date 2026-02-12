---
task: booking-confirmation-pdf-template
timestamp_utc: 2026-02-12T18:31:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Confirmation PDF Template

## Objective

Generate a production-ready dynamic reservation confirmation PDF with complete booking details and branded layout.

## Success Criteria

- [ ] PDF response includes booking reference, guest name, date, time, party size, venue name, venue address, status, and notes.
- [ ] Header branding is visible in the PDF.
- [ ] Endpoint continues to enforce existing auth/session-recovery authorization.
- [ ] Output remains valid PDF bytes downloadable by browser clients.

## Architecture & Components

- `server/reservations/confirmation-pdf.ts`
- Replace static blob with dynamic one-page PDF renderer.
- Add formatting and sanitization helpers for display-safe text.

- `src/app/api/reservations/[id]/confirmation/route.ts`
- Expand booking select fields.
- Lookup restaurant metadata (`name`, `address`, `timezone`).
- Pass full payload into PDF builder.

## Data Flow & API Contracts

Endpoint: `GET /api/reservations/:id/confirmation`

- Input: reservation id + auth/session-recovery context.
- Output: `application/pdf` attachment with dynamic reservation details.
- Errors: same as existing route (`UNAUTHORIZED`, `FORBIDDEN`, token errors, not found).

## UI/UX States

- Browser download from Manage Booking “PDF” button now yields populated confirmation document.

## Edge Cases

- Missing notes/address/start time/date/timezone.
- Unknown/empty status labels.
- Long notes requiring line wrapping.

## Testing Strategy

- Lint + typecheck touched files.
- Route smoke test with valid session-recovery token to verify populated PDF bytes.
- Extract PDF text from bytes to confirm key fields are present.

## Rollout

- Direct bug/quality improvement rollout; no flag.
- Monitor confirmation route errors and support reports.

## DB Change Plan (if applicable)

- No schema changes.
