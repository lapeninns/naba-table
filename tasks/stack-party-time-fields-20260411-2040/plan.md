---
task: stack-party-time-fields
timestamp_utc: 2026-04-11T20:40:50Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Stack party size and time fields

## Objective

We will update the edit-booking timestamp picker so date, party size, and time each render in their own vertical row, making the form easier to scan and matching the requested layout.

## Success Criteria

- [ ] Party size no longer shares a horizontal row with time in the edit booking flow.
- [ ] Existing date, time, and party size interactions still work.
- [ ] Browser verification confirms the updated layout on the dev harness.

## Architecture & Components

- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx`: owns the grid/card layout for date + embedded party size + time.
- `components/dashboard/EditBookingDialog.tsx`: canonical consumer to verify after the layout change.

## Data Flow & API Contracts

- No request/response changes.
- No state contract changes.

## UI/UX States

- Default: date row, party size row, time row.
- Existing loading, unavailable, and validation states remain unchanged.

## Edge Cases

- Ensure the time picker still renders correctly when no slots are available.
- Ensure the embedded party size field still fits cleanly inside its card wrapper.

## Testing Strategy

- Automated: lint the touched component.
- Manual: Chrome DevTools MCP on the ops bookings dev harness and edit dialog.

## Rollout

- No feature flag.
- Ship directly in the canonical edit flow.

## DB Change Plan (if applicable)

- No database changes.
