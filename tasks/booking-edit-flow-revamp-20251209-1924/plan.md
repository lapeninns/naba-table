---
task: booking-edit-flow-revamp
timestamp_utc: 2025-12-09T19:24:23Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Edit Flow Revamp

## Objective

Ensure the booking edit dialog and date/time picker provide stable, non-destructive editing: preserve user input across background refreshes, auto-load available slots, and present accurate date/time states.

## Success Criteria

- [ ] Opening edit dialog loads schedule and auto-selects first available slot when appropriate.
- [ ] Form values do not reset on background refetch while dialog remains open.
- [ ] Date does not revert when party size changes; user-selected date persists.
- [ ] Date button text fits without truncation.
- [ ] Time input clears when no slots exist and never shows stale times.
- [ ] No a11y regressions (keyboard, focus, labels) in dialog/picker.

## Architecture & Components

- `components/dashboard/EditBookingDialog.tsx`: Manage form initialization/reset and background refetch behavior.
- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx`: Handle date/time selection, slot availability, guards for state sync/reset, and auto-selection logic.
- `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx`: Present date selection with short format and reconcile time display with availability.

## Data Flow & API Contracts

- Relies on existing hooks/services for booking data and schedule slots (no API changes planned). Maintain current contract; adjust component-level state only.

## UI/UX States

- Loading: show disabled picker while fetching initial slots, but do not permanently lock.
- Empty/unavailable: show "No available times" and clear time input.
- Error: preserve existing error handling; ensure state sync does not override user selections.
- Success: auto-select first available slot when slots exist and user has not chosen a time.

## Edge Cases

- Rapid date changes while slots refetch.
- Background refetch updating booking object mid-edit.
- Party size changes affecting availability without resetting selected date.
- Transition from unavailable date to available date and vice versa.

## Testing Strategy

- Unit/component-level checks where feasible (existing test harness permitting) for picker logic.
- Manual QA via Chrome DevTools MCP: mobile/desktop, keyboard navigation, date/time changes, party size change flow.
- Smoke app flow for editing an existing booking to ensure values persist.

## Rollout

- No feature flag; immediate rollout after verification.
- Monitoring: rely on existing error tracking/analytics; note follow-up if anomalies observed.
- Kill-switch: revert commit if regressions detected.

## DB Change Plan (if applicable)

- N/A (UI/state only).
