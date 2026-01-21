---
task: ops-booking-card-collapse-fix
timestamp_utc: 2026-01-21T13:25:00Z
owner: github:@sisyphus
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: OpsBookingCard Collapse Toggle Fix

## Objective

Allow repeated expand/collapse on mobile while keeping auto-expand for urgent bookings.

## Success Criteria

- Mobile toggle can open/close repeatedly.
- Auto-expand runs once for urgent bookings and does not override user choice.

## Approach

- Add refs to track auto-expand and user-toggle state.
- Update `onOpenChange` to set user-toggled flag.

## Testing Strategy

- Manual QA via Chrome DevTools at 375px.
