---
task: booking-edit-flow-revamp
timestamp_utc: 2025-12-09T19:24:23Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review current implementations of EditBookingDialog and ScheduleAwareTimestampPicker to confirm existing issues.
- [x] Identify overlapping patterns with Reserve calendar field.

## Core

- [x] Adjust form reset logic to avoid background refetch resets while keeping open->reset behavior.
- [x] Simplify/clarify time disabled logic for slot availability.
- [x] Ensure selection mode guards allow initial load and auto-selection without blocking user changes.
- [x] Preserve user-selected date across party size changes.

## UI/UX

- [x] Use short date format in calendar button to prevent truncation.
- [x] Clear time input when slots unavailable; avoid stale time display.
- [ ] Validate focus/keyboard interactions remain intact.

## Tests

- [x] Run targeted tests (lint on touched files).
- [ ] Manual QA via Chrome DevTools MCP; capture artifacts.

## Notes

- Assumptions: No API contract changes required; fixes are confined to component state management.
- Deviations: Document if further refactor needed beyond planned scope.

## Batched Questions

- Clarify whether a clean rewrite is desired or incremental fixes suffice.
