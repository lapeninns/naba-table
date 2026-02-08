---
task: rebuild-old-crown-zones-tables
timestamp_utc: 2026-02-08T16:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Rebuild Old Crown Girton Zones + Tables (Prod)

## Objective

Rebuild `zones`, `table_inventory`, and `table_adjacencies` for Old Crown Girton in production to match the new 4-zone / 18-table layout, while preserving operational continuity by remapping existing booking table references.

## Success Criteria

- [ ] Exactly 4 zones named `Zone 1..4`.
- [ ] Exactly 18 active tables with table_numbers: `01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17,18` (with capacities/mobility as specified).
- [ ] Exactly 64 directed adjacency rows, all-to-all within each zone.
- [ ] No remaining references to deleted old table IDs in `bookings` or `booking_table_assignments`.
- [ ] No guest emails are sent (direct DB updates only; do not call modification endpoints).

## Approach

Single production script:

1. **Preflight** (read-only + artifacts):
   - Snapshot old zones/tables/adjacencies.
   - Identify referenced old table IDs.
   - Validate that one-to-one remapping is feasible.
2. **Expand**:
   - Insert new zones + new tables + new all-to-all adjacencies.
3. **Remap**:
   - Update `booking_table_assignments.table_id` and `bookings.table_id` from old to new.
   - Update `bookings.assigned_zone_id` to match mapped table zone.
4. **Contract**:
   - Delete holds/soft-holds/scarcity metrics for restaurant.
   - Delete old adjacencies + old tables + old zones.
5. **Postflight**:
   - Verify counts and invariants; write artifacts.
