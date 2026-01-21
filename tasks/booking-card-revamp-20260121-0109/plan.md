---
task: booking-card-revamp
timestamp_utc: 2026-01-21T01:10:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Card Revamp

## Objective

We will reorganize the Ops booking card into a clear multi-column grid so operators can scan customer, table, and contact details faster.

## Success Criteria

- [ ] Booking card shows grouped sections in a responsive grid (1–4 columns by breakpoint).
- [ ] All existing booking actions and status indicators still function and remain accessible.

## Architecture & Components

- `OpsBookingCard`: update layout structure and grouping only.
- `BookingsList`/`BookingsTable`: no changes expected.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Loading overlay remains intact.
- Responsive layout scales across mobile/tablet/desktop.
- Actions (check-in/out, no-show, etc.) remain visible and keyboard accessible.

## Edge Cases

- Missing table assignment or contact info.
- Very long notes or guest names.

## Testing Strategy

- Manual QA with Chrome DevTools MCP (responsive + a11y).
- Spot-check interaction buttons and focus order.

## Rollout

- No feature flag (scope limited to UI layout).
- Verify on dashboard and bookings pages.

## DB Change Plan (if applicable)

- N/A.
