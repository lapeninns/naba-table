---
task: time-slot-selection-bug
timestamp_utc: 2025-12-10T11:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Time slot selection bug

## Objective

Ensure changing time after selecting a date does not show stale "Selected time is no longer available" when slot is still valid; update availability state correctly.

## Success Criteria

- [ ] Users can select a date, change time, and proceed without erroneous availability error when slot exists.
- [ ] Error shows only when backend reports slot unavailable.
- [ ] Automated/updated tests cover date change + time change flow.

## Architecture & Components

- TODO: identify booking form components handling date/time.
- TODO: note state management and API interactions.

## Data Flow & API Contracts

- TODO: document availability endpoint request/response relevant fields.

## UI/UX States

- Loading / Empty / Error / Success states remain intact; error clears when user picks new time/date.

## Edge Cases

- Date change clears previous time selection.
- Backend returns slot unavailable mid-selection.
- Time picker shows outdated options.

## Testing Strategy

- Unit/integration test around date change -> time change -> availability validation.
- Manual QA of booking flow.

## Rollout

- No feature flag expected; ensure regression risk low.

## DB Change Plan (if applicable)

- N/A
