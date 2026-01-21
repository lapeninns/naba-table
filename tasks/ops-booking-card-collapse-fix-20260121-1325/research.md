---
task: ops-booking-card-collapse-fix
timestamp_utc: 2026-01-21T13:25:00Z
owner: github:@sisyphus
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: OpsBookingCard Collapse Toggle Fix

## Requirements

- Fix mobile collapse toggle so it can expand/collapse repeatedly.
- Preserve auto-expand for late/overdue bookings without locking the UI.
- Shadcn primitives only.

## Existing Patterns & Reuse

- `Collapsible` used in `components/dashboard/OpsBookingCard.tsx` with `isOpen` state.

## Constraints & Risks

- Must not change external props or actions.

## Recommended Direction

- Track user-initiated toggles so auto-expand runs only once and respects manual collapse.
