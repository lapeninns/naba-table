---
task: clone-old-school-house-production
timestamp_utc: 2026-03-25T16:08:31Z
owner: github:@openai
reviewers: [github:@openai]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Clone The Old School House into production

## Objective

We will create The Old School House in production using The Old Crown Girton as the configuration source, while replacing the source venue profile and weekly opening hours with The Old School House’s own details.

## Success Criteria

- [ ] New production restaurant exists with the target slug and venue details.
- [ ] Weekly hours match The Old School House schedule.
- [ ] Service periods, zones, tables, and adjacencies are cloned from source.
- [ ] No bookings/customers/history are copied.
- [ ] At least the source manager membership is granted to the new restaurant.

## Architecture & Components

- `server/restaurants/create.ts`: create canonical restaurant record + membership pattern reference
- `scripts/clone-restaurant-config.ts`: guarded one-off production clone tool
- Supabase production DB via service-role access from `.env.vercel-production.live`

## Data Flow & API Contracts

- Read source data from:
  - `restaurants`
  - `restaurant_operating_hours`
  - `restaurant_service_periods`
  - `restaurant_turn_bands`
  - `zones`
  - `table_inventory`
  - `table_adjacencies`
  - `restaurant_memberships`
- Write target data into the same restaurant-scoped tables with fresh IDs where needed.

## UI/UX States

- No UI changes.

## Edge Cases

- Existing target slug should fail fast.
- Dated operating-hour overrides should be excluded.
- Adjacencies should be remapped from old table IDs to new table IDs.
- Missing source turn bands should result in zero inserted turn bands, not an error.

## Testing Strategy

- Dry-run/guard validation in script logic.
- Post-write readback verification from production.

## Rollout

- Single controlled production write.
- Project ref must match `vrdiqfudmwydclqpydee`.
- Verification immediately after write.
