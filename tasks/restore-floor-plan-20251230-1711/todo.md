---
task: restore-floor-plan
timestamp_utc: 2025-12-30T17:11:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm floor plan file list and scope
- [x] Compare files vs `main`

## Core

- [x] Restore selected files from `main`
- [x] Restore seating floor plan route from `main`
- [x] Add Floor Plan item to Daily operations sidebar
- [x] Add `/floor-plan` route alias and update redirects
- [ ] Make `/seating/floor-plan` redirect to `/floor-plan` (canonical URL)
- [x] Make `/seating/floor-plan` redirect to `/floor-plan` (canonical URL)
- [ ] Verify no unrelated changes

## UI/UX

- [ ] Manual QA via Chrome DevTools MCP (if UI changed)

## Tests

- [ ] Targeted checks (if needed)

## Notes

- Assumptions:
  - Restoring floor plan means using `BookingAssignmentTabContent` + `TableFloorPlan` in `BookingDialog`.
- Deviations:
  - Proceeded on dirty working tree per user instruction.

## Batched Questions

-
