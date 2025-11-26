---
task: reset-floorplan
timestamp_utc: 2025-11-25T23:54:26Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Reset floorplan zones and tables

## Objective

Rebuild the venue's zones and table inventory to match the new specification, ensuring the Bar is restricted to drinks-only bookings.

## Success Criteria

- [ ] Existing zone/table records are removed or archived per pattern, with no stale references.
- [ ] New zones/tables match provided counts, capacities, and movability flags.
- [ ] Bar zone tagged/flagged so booking UI/API treats it as drinks-only (per existing schema conventions).

## Architecture & Components

- Floor/zone/table data source (DB tables or config/seed files) updated to new definitions.
- Any cache/derived structures (e.g., floor plan JSON, manual assignment maps) regenerated if needed.

## Data Flow & API Contracts

- No new endpoints expected; ensure existing booking APIs reflect updated inventory.

## UI/UX States

- N/A unless UI surfaces require manual QA to confirm counts and labels.

## Edge Cases

- Legacy bookings referencing removed tables.
- Movable vs non-movable flags must map to existing schema fields.

## Testing Strategy

- Unit/logic: verify table counts and attributes in seed/config where applicable.
- Integration/manual: run booking flow to confirm zones and Bar restriction behavior.
- A11y: unchanged but ensure any UI updates remain compliant.

## Rollout

- Apply to target environment after validation; ensure backup/rollback plan if touching live DB.
- No feature flag anticipated unless drinks-only requires toggle.

## DB Change Plan (if applicable)

- If DB seeds/migrations are involved: generate diff and attach to artifacts; confirm staging-first.
- Ensure idempotent scripts for wiping/reseeding where feasible.
