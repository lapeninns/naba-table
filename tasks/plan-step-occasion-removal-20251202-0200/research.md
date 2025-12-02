---
task: plan-step-occasion-removal
timestamp_utc: 2025-12-02T02:00:26Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove occasion input from plan step

## Requirements

- Functional: Remove the occasion selector from the plan step; keep flow functional without that field. Move notes input outside the accordion so it is always visible. Adjust summaries/copy so they no longer mention occasion.
- Non-functional: Maintain a11y (labels, focus order), keep existing validation for date/time/party, avoid regressions in booking submission.

## Existing Patterns & Reuse

- Plan step form already uses `NotesField`, `TimeSlotGrid`, and `OccasionPicker` within an accordion. We can reuse `NotesField` and `TimeSlotGrid` and drop the `OccasionPicker` component.
- Booking type is currently inferred from time slots as a fallback; keep automatic inference but hide manual selection.

## External Resources

- None needed; change is UI/flow only.

## Constraints & Risks

- Removing the required `bookingType` field from validation must not break submission; ensure defaults/inference still set a value for downstream steps.
- Accordion summary and tests currently reference occasion; need to update tests to match new copy.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Make `bookingType` optional/hidden by relaxing schema validation; keep automatic inference on time selection to populate state.
- Simplify accordion header/summary to reference time only. Render notes below the accordion so it is always visible.
- Update tests that assert on summary text or occasion picker.
