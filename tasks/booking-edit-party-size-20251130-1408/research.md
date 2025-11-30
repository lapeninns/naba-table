---
task: booking-edit-party-size
timestamp_utc: 2025-11-30T14:08:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Align edit booking party size field with create form

## Requirements

- Functional:
  - Editing a booking should allow changing party size without triggering validation errors seen in current PUT /api/bookings/... requests.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessibility semantics in booking forms.
  - No regression to client-side performance.
  - No secrets or PII leaks.

## Existing Patterns & Reuse

- Edit booking UI lives in `components/dashboard/EditBookingDialog.tsx` and currently uses a plain `<Input type="number">` for `partySize` with zod coercion.
- API handler `src/app/api/bookings/[id]/route.ts` first validates with `dashboardUpdateSchema` (uses `partySize: z.coerce.number().int().min(MIN_ONLINE_PARTY_SIZE).max(MAX_ONLINE_PARTY_SIZE)`). Invalid `partySize` falls through to the legacy schema and returns 400.
- Guest/create flow uses the `PartySizeField` stepper component at `reserve/features/reservations/wizard/ui/steps/plan-step/components/PartySizeField.tsx`, with increment/decrement controls that enforce valid values upstream.

## External Resources

- None yet.

## Constraints & Risks

- If we reuse the PartySizeField component, we must enforce min/max bounds locally (create flow relies on parent handlers for limits).
- Risk of UI import bloat across `reserve` aliases—keep the component reuse minimal and avoid altering the shared component itself.

## Open Questions (owner, due)

- What validation schema is used for update vs create? (owner: assistant, due: 2025-11-30)
- Is API expecting same field name/type for party size? (owner: assistant, due: 2025-11-30)

## Recommended Direction (with rationale)

- Mirror the create booking party size input and validation in the edit booking form and ensure payload matches API expectations. Rationale: reuse proven create flow to eliminate mismatch errors.
