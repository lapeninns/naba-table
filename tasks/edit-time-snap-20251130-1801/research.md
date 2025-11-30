---
task: edit-time-snap
timestamp_utc: 2025-11-30T18:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Edit dialog time snapping

## Requirements

- Functional: In the booking edit dialog, time entry should snap to 15-minute increments (00, 15, 30, 45, 60) like the create flow to avoid the “Selected time is no longer available” error when typing arbitrary minutes.
- Non-functional: Keep UX consistent with create flow; avoid regressions in availability validation.

## Existing Patterns & Reuse

- `ScheduleAwareTimestampPicker` already powers both create and edit flows and passes `intervalMinutes` to `Calendar24Time` (default 15).
- `Calendar24Time` uses the `step` attribute for the native time input, but `handleTimeChange` currently only validates exact matches without snapping.

## External Resources

- N/A (logic fully in app code).

## Constraints & Risks

- Low risk: Single component change; must ensure availability validation still triggers when slot truly unavailable.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Snap manually entered times to the current schedule interval (default 15 minutes) before validating availability, so typed values align with slot grid and avoid spurious “no longer available” errors.
