---
task: edit-booking-dialog-refactor
timestamp_utc: 2025-12-02T00:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Refactor EditBookingDialog (SOLID)

## Requirements

- Maintain existing booking edit functionality for both ops and guest flows.
- Improve modularity/readability: separate responsibilities (state derivation, form config, presentation), reduce repetition.
- Preserve a11y and UX (validation, disabled states, alerts, focus behavior, copy).

## Existing Patterns & Reuse

- Current dialog lives at `components/dashboard/EditBookingDialog.tsx`, shared by ops + guest detail page.
- Uses `react-hook-form`, zod schema, `ScheduleAwareTimestampPicker`, `PartySizeField`, toast, alerts.
- Error copy map and schema inline; date/interval derivations inline.

## Constraints & Risks

- Shared usage means changes must be non-breaking for guest and ops surfaces.
- Keep props API stable (do not change prop names/signatures).
- Avoid over-abstracting; keep refactor localized.

## Open Questions

- None; scope is internal refactor.

## Recommended Direction

- Introduce small pure helpers for derived values (interval, end time, labels) to make render lean.
- Extract form creation into a `useEditBookingForm` hook within the module (single responsibility for form state + handlers).
- Keep schema/error copy co-located but outside component to avoid re-creation.
