---
task: booking-list-table-assignments
timestamp_utc: 2026-01-20T16:51:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking List Table Assignments

## Requirements

- Functional:
  - Ops bookings list must display assigned table labels when assignments exist.
  - "No table assigned" should only appear when the booking has no table assignments.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing a11y semantics in booking cards.
  - Avoid N+1 queries or heavy per-row lookups.
  - Supabase access remains remote-only via server route.

## Existing Patterns & Reuse

- `components/dashboard/OpsBookingCard.tsx` renders table info from `booking.tableAssignments`.
- `/bookings` uses `src/components/features/bookings/OpsBookingsClient.tsx` + `useOpsBookingsList`.
- Detail endpoint `src/app/api/ops/bookings/[id]/route.ts` already maps `booking_table_assignments` with `table_inventory` into `tableAssignments`.

## External Resources

- N/A

## Constraints & Risks

- List endpoint currently omits table assignment mapping; UI interprets missing data as "No table assigned".
- Adding nested joins increases payload size; must keep selection minimal and avoid per-row follow-ups.

## Open Questions (owner, due)

- Q: Is the issue confined to the ops `/bookings` page (not guest bookings)? (owner: user, due: ASAP)
  A: Yes — admin/ops bookings page only. (confirmed 2026-01-20)

## Recommended Direction (with rationale)

- Extend `src/app/api/ops/bookings/route.ts` to select `booking_table_assignments` with `merge_group_id` and `table_inventory`, then map into `tableAssignments` using the same grouping logic as the detail endpoint. This aligns list and detail shapes without extra queries.
