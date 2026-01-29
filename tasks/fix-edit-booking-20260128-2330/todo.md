---
task: fix-edit-booking
timestamp_utc: 2026-01-28T23:30:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Trace Edit Booking button handler and dialog open state
- [x] Verify API update path and request payload
- [x] Implement fix for edit flow

## UI/UX

- [ ] Confirm keyboard and focus behavior in edit dialog (blocked by auth gating)

## Tests

- [x] Update/add tests if needed (no updates required; existing tests pass)

## Notes

- Assumptions:
- Deviations:
- Manual QA blocked by ops sign-in; needs credentials or seeded session to verify edit flow
