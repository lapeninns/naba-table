---
task: booking-queue-revamp
timestamp_utc: 2025-12-01T23:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking queue UI revamp (ops)

## Objective

Revamp the ops booking queue table to present richer booking data (contact, reference, seating/notes, table capacity delta) in a compact, well-structured layout while preserving actions and responsiveness.

## Success Criteria

- [ ] Desktop table shows additional ops fields: reference, phone, seating prefs/allergies badge, table assignment count, capacity delta, source/loyalty hints, notes preview.
- [ ] Header area tightened; search+filters aligned; reduced vertical whitespace without losing clarity.
- [ ] Guest variant unchanged; mobile list unchanged.
- [ ] A11y: headers/controls remain focusable, hit targets ≥44px, semantic table preserved.

## Architecture & Components

- Enhance `components/dashboard/BookingsTable` (desktop path) to use a new denser header layout and row subcomponents.
- Extend `components/dashboard/BookingRow` to render richer ops details with helper utilities: contact block, metadata chips, capacity delta from `tableAssignments` and `partySize`.
- Add lightweight helper functions (pure) for capacity/table summaries.

## Data Flow & API Contracts

- No API changes. Use existing `BookingDTO` enriched via ops mapping (already contains tableAssignments, reference, phone, etc.). Compute derived values client-side.

## UI/UX States

- Loading skeleton updated to reflect denser columns.
- Empty/error states unchanged.

## Edge Cases

- Missing contact info, notes, or assignments should show graceful placeholders (em dash, badges hidden).
- Negative capacity delta should highlight in warning tone; positive/zero neutral/positive.
- Long text truncated with tooltips/titles.

## Testing Strategy

- Manual UI check desktop: spacing, new fields, hover titles, tab order.
- Quick keyboard focus through filters and actions.

## Rollout

- No flag. Direct change.

## DB Change Plan

- N/A.
