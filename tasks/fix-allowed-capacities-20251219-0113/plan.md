---
task: fix-allowed-capacities
timestamp_utc: 2025-12-19T01:15:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove allowed_capacities writes

## Objective

Ensure ops table create/update no longer writes to `public.allowed_capacities` now that the table is removed.

## Success Criteria

- [ ] Table create/update routes no longer call `ensureAllowedCapacity`.
- [ ] No code path attempts to insert into `allowed_capacities`.

## Architecture & Components

- `server/ops/tables.ts`: remove `ensureAllowedCapacity` (and `loadAllowedCapacities` if unused).
- `src/app/api/ops/tables/route.ts`: remove ensure step during create.
- `src/app/api/ops/tables/[id]/route.ts`: remove ensure step during update.

## Data Flow & API Contracts

- No API contract changes; capacity is still a field on `table_inventory` requests.
- Only the side-effect of upserting into `allowed_capacities` is removed.

## UI/UX States

- No UI changes.

## Edge Cases

- Verify that removing the ensure step does not introduce new validation errors.

## Testing Strategy

- No automated tests added (scope). If tests exist for table routes, run relevant ones.

## Rollout

- No feature flag. Roll out with standard deploy.

## DB Change Plan (if applicable)

- None (already handled by migration).
