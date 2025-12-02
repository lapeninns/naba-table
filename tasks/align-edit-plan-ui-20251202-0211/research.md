---
task: align-edit-plan-ui
timestamp_utc: 2025-12-02T02:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Align edit booking dialog UI with plan step

## Requirements

- Functional: Reuse the same plan-step scheduling UI (date, party size, time grid) inside the Edit Booking dialog so edit uses the same UX as create. Keep notes input accessible. Preserve edit-specific behaviors (existing booking prefill, update mutation).
- Non-functional: Maintain accessibility (keyboardable date/time, focus order), avoid breaking validation, and keep layout responsive in dialog.

## Existing Patterns & Reuse

- The create flow uses `PlanStepForm` with `Calendar24Date`, `Calendar24Time`, `PartySizeField`, and `TimeSlotGrid` plus a summary accordion.
- Edit dialog currently uses `ScheduleAwareTimestampPicker` (also built on `Calendar24Date/Time` and `TimeSlotGrid`) but with different copy/layout; it lives in `components/features/booking-state-machine` and is rendered inside `components/dashboard/EditBookingDialog.tsx`.
- There are existing props `timeAccordion` and `timeScrollArea` to vary layout; we can leverage/extend these instead of rebuilding UI.

## External Resources

- None needed; all components are in-repo.

## Constraints & Risks

- Edit dialog must keep mutation wiring (`useUpdateBooking`) and prefill/dirty tracking intact.
- Changing copy/structure could affect any implicit tests; none found for `ScheduleAwareTimestampPicker`, but need to smoke-check dialog layout manually later.

## Open Questions (owner, due)

- Should notes stay outside the accordion like plan? (Assume yes; already outside.)
- Should we use the exact plan summary text? (Plan uses “Time: …”; will mirror for consistency.)

## Recommended Direction (with rationale)

- Add a “plan-like” presentation option to `ScheduleAwareTimestampPicker` (e.g., `variant="plan"` or reuse `timeAccordion` with plan copy) that:
  - Uses the same summary text as plan (“Time: …” / “Time not selected”).
  - Sets the accordion heading to “Time options” to match plan.
  - Defaults to showing the accordion instead of the scroll-area time list when enabled.
- Update `EditBookingDialog` to enable this variant (and the accordion) so the layout matches create without duplicating logic.
