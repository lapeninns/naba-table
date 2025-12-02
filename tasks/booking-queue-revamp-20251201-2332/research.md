---
task: booking-queue-revamp
timestamp_utc: 2025-12-01T23:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking queue UI revamp (ops dashboard)

## Requirements

- Functional: Redesign bookings queue (ops) with denser layout, better hierarchy, and more fields from bookings dataset (reference, contact, table assignment/capacity delta, notes, source/loyalty). Keep filters/search/pagination.
- Non-functional: Maintain a11y (WCAG), keyboard/tab order, responsive behavior; avoid CLS; keep performant (no extra requests); keep existing actions (Details, Edit, Cancel, lifecycle buttons) intact.

## Existing Patterns & Reuse

- `components/dashboard/BookingsTable` renders header, table, empty, pagination; uses `BookingRow`.
- Ops bookings data includes `reference`, `tableAssignments`, `seatingPreference`, `allergies`, `dietaryRestrictions`, `customerPhone`, `source`, `loyaltyTier/points`, `checkedInAt`, `checkedOutAt` (see `OpsBookingListItem`). Not currently surfaced.
- Status chips and action buttons already exist (`BookingStatusBadge`, `BookingActionButton`).

## External Resources

- None required; design driven by internal data and UX principles.

## Constraints & Risks

- Must not break guest variant (`variant="guest"`).
- Table must remain readable on mobile; consider stacking details via existing `BookingsListMobile` (unchanged) so changes should be gated to desktop layout.
- Avoid widening columns excessively; keep responsive at 1024px widths.

## Open Questions (owner, due)

- None; proceed with incremental redesign.

## Recommended Direction (with rationale)

- Create a denser, info-rich desktop row layout by grouping fields (primary booking details, contact, seating/notes, capacity/table info) and aligning actions in a compact toolbar.
- Add derived display helpers for table count and capacity delta using available `tableAssignments` and `partySize` to show fit at a glance.
- Keep header compact: single-line title+meta count, filters aligned to the right.
- Modularize row sections into small subcomponents (SOLID) within `BookingsTable`/`BookingRow` to isolate formatting and avoid duplication.
