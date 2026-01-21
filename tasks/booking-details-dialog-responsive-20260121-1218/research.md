---
task: booking-details-dialog-responsive
timestamp_utc: 2026-01-21T12:18:00Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Details Dialog Responsive Update

## Requirements

- Shadcn UI primitives only.
- Responsive across mobile/tablet/desktop with no overflow or truncation issues.
- Visual principles aligned with OpsBookingCard (dense, scannable, clear hierarchy).

## Existing Patterns & Reuse

- `BookingDialog` uses Shadcn `Dialog` and `Sheet` with `useIsMobile` and `ScrollArea` panels.
- OpsBookingCard uses compact summary layout and status indicators.

## Constraints & Risks

- Dialog is used in multiple views; changes must be safe and consistent.
- Must preserve lifecycle actions and table assignment flows.

## Open Questions

- None.

## Recommended Direction

- Update header and body layout spacing for mobile.
- Improve wrapping and grid behavior to avoid overflow across breakpoints.
