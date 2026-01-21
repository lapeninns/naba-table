---
task: booking-details-dialog-responsive
timestamp_utc: 2026-01-21T12:18:00Z
owner: github:@sisyphus
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Dialog Responsive Update

## Objective

Improve responsiveness and scanability of the Booking Details dialog across devices while keeping Shadcn primitives and OpsBookingCard styling principles.

## Success Criteria

- Dialog header and key metadata are readable without truncation on mobile.
- No horizontal overflow in ScrollArea panels.
- Mobile Sheet layout uses compact spacing with clear hierarchy.

## Architecture & Components

- `BookingDialog` (main orchestrator)
- `DialogHeader` and sub-panels in `booking-details` module

## UI/UX States

- Loading / Error / Success states must remain intact.

## Testing Strategy

- Manual QA in Chrome DevTools MCP at 375px/768px/1280px.

## Rollout

- No feature flags; safe UI-only update.
