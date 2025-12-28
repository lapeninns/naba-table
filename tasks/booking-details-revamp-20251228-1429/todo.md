---
task: booking-details-revamp
timestamp_utc: 2025-12-28T14:29:58Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm dialog/sheet pattern in existing dashboard UI (Sheet on mobile, Dialog on desktop).
- [x] Confirm booking time type (ISO strings; normalize in utilities).

## Core

- [x] Wire BookingDialog composition and states.
- [x] Implement ArrivalCountdown with severity mapping.
- [x] Implement BookingStatusBadge mapping.
- [x] Implement table assignment panel with validation + confirmation.

## UI/UX

- [x] Mobile-first layout with tabs/accordion.
- [x] Desktop two-column layout.
- [x] Loading/empty/error states.
- [x] A11y roles, labels, focus management.

## Tests

- [x] Unit tests for utils.
- [x] Unit tests for useTableAssignment validation logic.
- [x] BookingDialog smoke test for loading/error/success.

## Notes

- Assumptions:
- Manual QA will be performed via Chrome DevTools MCP after dev server launch.
- Deviations:

## Batched Questions

- None yet.
