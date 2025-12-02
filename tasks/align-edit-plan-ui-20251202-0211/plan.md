---
task: align-edit-plan-ui
timestamp_utc: 2025-12-02T02:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Align edit dialog with plan-step UI

## Objective

Present the same date/party/time UX from the plan step inside the Edit Booking dialog by configuring `ScheduleAwareTimestampPicker` to render the plan-style accordion and copy, without altering edit-specific logic.

## Success Criteria

- Edit dialog shows the same date/party/time layout and summary copy as the plan step (accordion labeled “Time options”, summary “Time: …”).
- Functionality unchanged: can edit date, time, party size, notes; submits successfully.
- No regressions to create flow; default variant remains untouched there.

## Architecture & Components

- `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx`
  - Add a plan-style variant flag (e.g., `variant?: 'default' | 'plan'`).
  - When plan variant is enabled: use plan summary text, heading “Time options”, and prefer accordion layout; align spacing.
- `components/dashboard/EditBookingDialog.tsx`
  - Enable the plan variant and accordion for the time picker; adjust props/copy to match plan wording if needed.

## Data Flow & Contracts

- No API changes. `onChange` continues to emit ISO start time. Party size remains managed via existing callbacks.

## UI/UX States

- Accordion summary: “Time: {display}” or “Time not selected”.
- Unavailable/closed states continue to show warnings; loading state unchanged.

## Edge Cases

- No available slots: summary should still convey “No times available”; keep existing error handling.
- Prefill times outside availability: ensure summary handles missing selection gracefully.

## Testing Strategy

- Manual sanity: open Edit Booking dialog, verify accordion/summary and ability to select date/time/party size.
- Spot-check create flow to ensure default layout unaffected (plan step still looks correct).
- No automated tests exist for this component; note manual verification needed.

## Rollout

- No feature flag. Small UI alignment; verify locally and capture notes in `verification.md`.
