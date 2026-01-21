---
task: booking-card-revamp
timestamp_utc: 2026-01-21T01:10:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm grouping requirements (responsive columns, grouping order)
- [x] Review current `OpsBookingCard` layout and fields

## Core

- [ ] Reorganize layout into responsive grid sections
- [ ] Preserve existing actions and status UI
- [ ] Handle missing data gracefully

## UI/UX

- [ ] Responsive layout (mobile/tablet/desktop)
- [ ] A11y labels and focus order preserved
- [ ] Notes truncation or wrapping rules confirmed

## Tests

- [ ] Manual QA via Chrome DevTools MCP (dashboard + bookings)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
