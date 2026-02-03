---
task: fix-ops-dashboard-cancel
timestamp_utc: 2026-02-03T17:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current ops cancel wiring and target components.

## Core

- [x] Wire ops cancel action to existing cancellation mutation/dialog.
- [x] Ensure list/detail queries invalidate as expected.

## UI/UX

- [ ] Verify action menu and dialog behavior on desktop and mobile.
- [ ] Confirm a11y labels and keyboard activation.

## Tests

- [x] Run targeted tests if available (TBD).
- [ ] Manual QA via Chrome DevTools MCP (required).

## Notes

- Assumptions:
- Deviations:
- Tests: `pnpm eslint --max-warnings=0 src/components/features/bookings/OpsBookingsClient.tsx src/components/features/dashboard/OpsDashboardClient.tsx src/components/features/dashboard/BookingsList.tsx src/components/features/dashboard/DashboardSummaryCard.tsx`

## Batched Questions

- Does ops cancel require confirmation dialog or immediate cancel? (confirm with existing pattern)
