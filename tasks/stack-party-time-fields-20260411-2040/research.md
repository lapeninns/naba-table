---
task: stack-party-time-fields
timestamp_utc: 2026-04-11T20:40:50Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: Stack party size and time fields

## Requirements

- Functional:
  - Update the booking edit surface so party size and time do not sit side by side in a multi-column row.
  - Keep the existing date selector and field behavior unchanged.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing keyboard navigation and labels.
  - Keep the change layout-only with no API or data-flow changes.

## Existing Patterns & Reuse

- `reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx` already places date, party size, and time in separate stacked cards.
- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx` still uses a `md:grid-cols-3` layout for date, embedded children (party size), and time.
- `components/dashboard/EditBookingDialog.tsx` is the current consumer of `ScheduleAwareTimestampPicker`.

## External Resources

- None needed. This is an internal layout adjustment on an existing component path.

## Constraints & Risks

- The workspace is already dirty; keep the diff tightly scoped to the canonical edit-booking path.
- Browser proof is still required because this is a UI change.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove the multi-column grid behavior from `ScheduleAwareTimestampPicker` so each panel renders on its own row.
- Reuse the existing card wrappers and field components so behavior, spacing, and accessibility remain stable while matching the requested layout.
