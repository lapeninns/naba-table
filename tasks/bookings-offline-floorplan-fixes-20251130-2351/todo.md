---
task: bookings-offline-floorplan-fixes
timestamp_utc: 2025-11-30T23:51:38Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify existing date handling in bookings views and shared utilities.
- [x] Locate floor-plan walk-in seating action and event handlers.
- [x] Find offline handling patterns/components (banner, service worker, router guard).

## Core

- [x] Fix bookings date filter to honor query param and show correct empty state for future dates.
- [x] Repair floor-plan "Walk-in Seating" control to trigger seating with validation.
- [ ] Add in-app offline handling for navigation (no browser error page).

## UI/UX

- [ ] Ensure responsive and accessible empty/offline states.
- [ ] Validate focus management and keyboard activation for seating button.

## Tests

- [x] Unit/integration tests for date filtering logic and offline handling. (date range helper)
- [ ] UI tests or component tests for floor-plan seating action.
- [ ] Axe/accessibility checks where applicable.

## Notes

- Assumptions:
- Deviations:
- Added `buildOpsDateRange` helper with unit coverage; remaining QA (UI/a11y, offline nav) still pending.

## Batched Questions

- [ ] Canonical source for service date across Dashboard/Bookings?
- [ ] Existing offline UI component/flag?
