---
task: booking-details-dialog-polish
timestamp_utc: 2026-01-21T12:45:00Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Details Dialog Polish & Performance

## Requirements

- Keep Shadcn primitives only.
- Improve perceived and actual performance (reduce heavy re-renders).
- Maintain responsive layout and OpsBookingCard visual principles.

## Existing Patterns & Reuse

- TableAssignmentPanel renders large grids of SelectableTableCard.
- SelectableTableCard exported and used by TableAssignmentPanel.

## Constraints & Risks

- Must not alter external dialog API.
- Changes should be minimal and safe across ops views.

## Recommended Direction

- Reduce re-render cost in TableAssignmentPanel by memoizing table cards and using Set lookups.
