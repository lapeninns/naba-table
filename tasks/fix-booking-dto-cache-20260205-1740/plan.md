---
task: fix-booking-dto-cache
timestamp_utc: 2026-02-05T17:40:25Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Ops Booking DTO Cache Key

## Objective

Ensure ops booking cards update table assignment labels after reassignment, even when the number of tables stays the same.

## Success Criteria

- [ ] Cache signature changes when table assignments change (IDs/numbers/sections).
- [ ] No behavior regressions in booking list virtualization.

## Architecture & Components

- `src/components/features/dashboard/list/BookingsListVirtualized.tsx`: extend signature generation for cached DTOs.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Updated assignment labels reflect immediately after reassignment.

## Edge Cases

- Same-count reassignment across different table IDs.
- Mixed group assignments (multiple members).

## Testing Strategy

- Manual verification: assign/unassign/reassign tables and confirm card labels update.

## Rollout

- No flag; safe UI behavior fix.

## DB Change Plan (if applicable)

- Not applicable.
