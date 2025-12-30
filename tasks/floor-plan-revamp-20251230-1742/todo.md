---
task: floor-plan-revamp
timestamp_utc: 2025-12-30T17:42:41Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm component list (Card, Sheet, Tabs/ToggleGroup, Tooltip, Popover, Badge, Separator)
- [x] Define default window minutes (±90) and URL param contract

## Core

- [x] Add bookings filters: tableId + time window in `/bookings` page and ops list filters
- [x] Update `GET /api/ops/bookings` to accept `tableId` filter
- [x] Wire floor plan actions to `/new-bookings` + `/bookings` with context params

## UI/UX

- [x] Rebuild `/floor-plan` layout with Shadcn primitives (header, toolbar, canvas, inspector)
- [x] Responsive inspector (Sheet on small screens; side panel on large)
- [x] Add “Browse bookings” toggle (All day vs Nearby)
- [x] Loading/empty/error states + offline handling
- [ ] A11y roles, labels, focus mgmt

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations: `/new-bookings` flow does not accept `tableId`, so only `date`, `time`, and `partySize` are passed.

## Batched Questions

- Ops credentials or an authenticated session for `/floor-plan` DevTools QA? (needed to complete Phase 4)
