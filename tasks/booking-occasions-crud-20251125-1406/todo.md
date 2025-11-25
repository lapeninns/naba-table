---
task: booking-occasions-crud
timestamp_utc: 2025-11-25T14:07:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm Supabase staging/prod project identifiers and credentials (remote only).
- [ ] Add feature flag `feat.ops.booking_occasions_crud` default on for ops.

## Core

- [ ] Extend `/api/ops/occasions` with CRUD + reorder, RBAC, audits, key immutability.
- [ ] Add DB tables/columns (`is_builtin`, `deleted_at`, audit fields; `restaurant_occasions`).
- [ ] Implement reference checks (service periods, future bookings) for deactivate/delete.
- [ ] Update catalog fetch to merge overrides (if introduced) and respect `deleted_at`/is_active.

## UI/UX

- [ ] Build settings section with table + drag/drop reorder + toggles + drawer form.
- [ ] Add confirmation flows for deactivate/delete; block builtin delete.
- [ ] Ensure responsive layout, focus management, keyboard reorder.

## Tests

- [ ] API unit tests for CRUD, reorder, validation, RBAC.
- [ ] Integration tests for schedule catalog reflecting changes.
- [ ] UI tests for table rendering, form validation, reorder, guarded delete.
- [ ] Axe/a11y checks on settings section.

## Notes

- Assumptions: key immutable; builtin occasions non-deletable.
- Deviations: restaurant-specific override table deferred for this iteration; focusing on global catalog CRUD first.

## Batched Questions

- Supabase project names/urls for staging/prod?
- Which roles map to org admin vs restaurant manager in auth layer?
- Confirm builtin set (lunch/drinks/dinner?).
