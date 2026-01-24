---
task: ops-dashboard-print
timestamp_utc: 2026-01-24T19:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: [feat.ops.print_bookings]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate ops dashboard toolbar/action area for print button.
- [x] Confirm existing ops bookings hook/service supports filters/search/sort/date.

## Core

- [x] Add print action button (Shadcn Button) with accessible label.
- [x] Implement print route and print view component.
- [x] Pass current filters/search/sort/date to print view.
- [x] Map bookings to print-only columns.

## UI/UX

- [x] Print layout: compact table with clear headers.
- [x] Print-only CSS (hide chrome, set page margins).
- [x] Loading/empty/error states.
- [x] Keyboard focus and visible focus styles.

## Tests

- [ ] Unit tests for row mapping.
- [ ] Integration test for print route.
- [ ] E2E smoke (optional, if test infra allows).
- [ ] Axe/Accessibility checks.

## Notes

- Assumptions:
  - Print view uses same data source as ops dashboard.
- Deviations:
  - None.

## Batched Questions

- None.
