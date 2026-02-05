---
task: fix-booking-dto-cache
timestamp_utc: 2026-02-05T17:40:25Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Ops Booking DTO Cache Key

## Requirements

- Functional:
  - Ensure ops booking cards refresh when table assignments change, even if the count stays the same.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No new dependencies or behavior regressions.
  - Preserve virtualization performance.

## Existing Patterns & Reuse

- `BookingsListVirtualized` caches `BookingDTO` using a signature derived from booking fields.
- `OpsTodayBooking.tableAssignments` includes `groupId` and member `tableId/tableNumber`.

## External Resources

- None.

## Constraints & Risks

- Cache key must remain stable and lightweight but include assignment identity.
- Avoid unnecessary re-renders for unrelated booking fields.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Extend the cache signature to include a deterministic representation of table assignment identities (groupId + member tableId/tableNumber).
