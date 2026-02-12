---
task: rebuild-old-crown-zones-tables
timestamp_utc: 2026-02-08T16:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Rebuild Old Crown Girton Zones + Tables (Production)

## Requirements

- Replace Old Crown Girton production:
  - `zones`
  - `table_inventory`
  - `table_adjacencies`
- Create 4 new zones (`Zone 1`..`Zone 4`) and 18 new tables (01..18 subset), with mobility/capacity as specified.
- Adjacencies: **all-to-all within each zone**, inserting both directions.
- Remap already-assigned bookings/assignments off old table IDs to “similar seating” new tables.
- Do not trigger guest emails.
- Hard delete old zones/tables/adjacencies after remap.

## Existing Patterns & Reuse

- Uses direct Supabase service role access (`@supabase/supabase-js`) similar to:
  - `scripts/update-railway-zones-tables.ts` (delete related inventory + holds + adjacencies).
  - `scripts/export-restaurant-zones-tables.ts` (export support).

## Constraints & Risks

- Production data mutation; must be guarded by explicit `CONFIRM_PRODUCTION=true`.
- FK constraints:
  - Booking references (`bookings.table_id`, `booking_table_assignments.table_id`, `bookings.assigned_zone_id`) must be moved off old IDs before deletion.
- Must avoid app endpoints that enqueue booking-side-effect emails (perform direct DB updates only).
