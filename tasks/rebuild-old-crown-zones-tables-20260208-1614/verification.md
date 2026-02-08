---
task: rebuild-old-crown-zones-tables
timestamp_utc: 2026-02-08T16:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Preflight

- [x] `artifacts/preflight.json` captured

## Apply

- [x] Script executed with `CONFIRM_PRODUCTION=true` (required `RESUME=true` due to partial earlier run)

## Postflight checks

- [x] Zones count = 4, names `Zone 1..4`
- [x] Tables count = 18, numbers `01..18`
- [x] Capacity breakdown: 2→4, 4→13, 7→1
- [x] Mobility breakdown: fixed→6, movable→12
- [x] Adjacencies count = 64 directed edges (forward edges counted; script inserts both directions)
- [x] `bookings.table_id` column does not exist in this production schema; booking assignment references are in `booking_table_assignments`
- [x] `booking_table_assignments.table_id` no longer references deleted old tables (enforced by successful old table deletion)

## Artifacts

- [x] `artifacts/new_inventory.json`
- [x] `artifacts/table_mapping.json` (may be empty if no upcoming assignments still referenced old tables at time of RESUME)
- [x] `artifacts/affected_bookings.json`
- [x] `artifacts/historical_assignment_remap.json`
- [x] `artifacts/postflight.json`
