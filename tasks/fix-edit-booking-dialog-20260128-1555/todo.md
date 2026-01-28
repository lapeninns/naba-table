---
task: fix-edit-booking-dialog
timestamp_utc: 2026-01-28T15:55:36Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create/update dialog state in ops clients

## Core

- [x] Wire Edit handler in `OpsBookingsClient`
- [x] Wire Edit handler in `OpsDashboardClient`
- [x] Pass `onEdit` through `DashboardSummaryCard` + `BookingsList`
- [x] Route ops edit updates through `/api/ops/bookings/[id]`

## UI/UX

- [x] Ensure details dialog closes when edit opens

## Tests

- [x] Add ops bookings dialog state test

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
