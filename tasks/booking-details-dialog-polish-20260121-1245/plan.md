---
task: booking-details-dialog-polish
timestamp_utc: 2026-01-21T12:45:00Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Dialog Polish & Performance

## Objective

Improve dialog responsiveness and reduce rendering overhead in table assignment without changing external APIs.

## Success Criteria

- Table grid renders with fewer unnecessary re-renders.
- Large table lists remain responsive during filtering and selection.

## Approach

- Add stable toggle handler and Set-based lookup for selections.
- Memoize SelectableTableCard to avoid re-render when props unchanged.

## Testing Strategy

- Manual QA at 375/768/1280px.
