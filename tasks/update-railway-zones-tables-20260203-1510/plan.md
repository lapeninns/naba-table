---
task: update-railway-zones-tables
timestamp_utc: 2026-02-03T15:10:44Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Update Railway Zones and Tables

## Objective

Update The Railway Pub zones and table inventory to match the new layout.

## Success Criteria

- [ ] Zones reflect the requested counts and mobility constraints.
- [ ] Table inventory matches requested capacities and zone assignments.

## Architecture & Components

- `scripts/update-railway-zones-tables.ts` (one-off data script).

## Data Flow & API Contracts

- Use service role client to update `zones`, `table_inventory`, and (if needed) `allowed_capacities`.

## UI/UX States

- N/A

## Edge Cases

- Existing bookings assigned to removed tables.

## Testing Strategy

- Read back counts by zone and capacity after update.

## Rollout

- One-off production execution after approval.

## DB Change Plan (if applicable)

- N/A
