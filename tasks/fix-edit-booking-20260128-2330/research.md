---
task: fix-edit-booking
timestamp_utc: 2026-01-28T23:30:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Edit Booking Button

## Requirements

- Functional:
  - Edit Booking button works on dashboard and bookings views.
  - Edit flow opens and allows save without errors.
- Non-functional (a11y, perf, security, privacy, i18n):
  - A11y: keyboard navigable, focus management, labeled controls.
  - Security: authorized access for edit endpoints only.

## Existing Patterns & Reuse

- Edit dialog: `components/dashboard/EditBookingDialog.tsx` (mode `ops` uses `useOpsUpdateBooking`).
- Ops bookings list: `src/components/features/bookings/OpsBookingsClient.tsx` → `BookingsTable` → `OpsBookingCard`.
- Ops dashboard list: `src/components/features/dashboard/OpsDashboardClient.tsx` → `DashboardSummaryCard` → `BookingsList` → `OpsBookingCard`.
- Edit handler: `onEdit` opens `EditBookingDialog` with `booking` + `restaurantSlug` + `restaurantTimezone`.
- Schedule input: `ScheduleAwareTimestampPicker` requires `restaurantSlug` for availability.

## External Resources

- N/A.

## Constraints & Risks

- Must follow AGENTS.md SDLC phases and manual UI QA via Chrome DevTools MCP.
- No DB changes expected.

## Open Questions (owner, due)

- Which exact pages/steps reproduce the broken edit flow? (owner: maintainer)

## Findings

- `EditBookingDialog` disables availability and save when `restaurantSlug` is missing (`missingScheduleMetadata`).
- Ops dashboard bookings list builds `BookingDTO` with `restaurantSlug: null` and relies on membership slug only; ops bookings list uses membership slug, but both flows can lack slug when membership data omits it.
- Fix: source `restaurantSlug` from `useOpsRestaurantDetails` and pass through `EditBookingDialog` + `BookingsList` booking DTO to guarantee schedule metadata.

## Recommended Direction (with rationale)

- Ensure `restaurantSlug` is always available for edit flows by using restaurant details as fallback and threading slug into dashboard/bookings edit dialogs.
