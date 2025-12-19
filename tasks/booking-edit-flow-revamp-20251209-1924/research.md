---
task: booking-edit-flow-revamp
timestamp_utc: 2025-12-09T19:24:23Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Edit Flow Revamp

## Requirements

- Functional:
  - Revamp booking edit flow, addressing regressions listed by user (form reset, time picker disablement, date truncation, date resets on party size change, stale time display, incorrect unavailable message, schedule not loading on dialog open).
  - Preserve user's in-progress edits across background data refresh.
  - Ensure date/time selection UX is consistent and resilient to rapid changes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain accessibility of dialog and picker components (keyboard, focus, labels).
  - No performance regressions; keep interactions responsive under rapid date changes.
  - No PII leakage; no secrets in code.

## Existing Patterns & Reuse

- `components/dashboard/EditBookingDialog.tsx` already wires `ScheduleAwareTimestampPicker` and `PartySizeField` with React Hook Form; reset is currently tied to `[open, reset]` to avoid background refetch resets.
- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx` centralizes schedule fetching, masking, and auto-selection; shares calendar/time primitives from the Reserve UI package.
- `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx` provides the calendar/time inputs used by the picker; supports short date labels and unavailable messaging.
- Plan: refine these existing components rather than introducing new primitives to stay aligned with DesignSystem and Shadcn usage.

## External Resources

- MCP research tools (Context7/DeepWiki) not available in this environment; completed manual code inventory of the three relevant components (paths above) to derive current behavior and gaps.

## Constraints & Risks

- UI change requires Chrome DevTools MCP artifacts in verification.
- Avoid over-engineering; keep changes scoped to booking edit flow.
- Potential coupling between shared picker component and multiple consumers; need to ensure no regressions elsewhere.
- Many files in repo already modified by others; avoid reverting unrelated in-progress work.

## Open Questions (owner, due)

- Do we need to preserve any previously applied fixes or fully rebuild from scratch? (owner: assistant, due: before implementation)
- Are there analytics or logging considerations for date/time selection changes? (owner: assistant, due: before implementation)

## Recommended Direction (with rationale)

- Perform focused refactor of booking edit dialog and schedule-aware timestamp picker to stabilize state management and auto-selection logic, aligning with listed fixes.
- Use short date formatting in calendar button to avoid truncation.
- Add guards to prevent destructive resets on background refetch while keeping initial dialog load behavior.
