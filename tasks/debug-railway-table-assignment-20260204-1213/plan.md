---
task: debug-railway-table-assignment
timestamp_utc: 2026-02-04T12:13:27Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Railway Table Assignment Failure

## Objective

Diagnose why table assignment fails for Railway Pub and identify corrective action.

## Success Criteria

- [ ] Railway Pub slug + restaurant_id confirmed.
- [ ] Adjacency data presence verified for Railway tables.
- [ ] Root cause identified with a concrete fix or mitigation.

## Architecture & Components

- server/capacity/table-assignment/\* for assignment + adjacency validation.
- Supabase tables: restaurants, table_inventory, table_adjacencies.
- Script: `scripts/build-zone-adjacency.ts` (full-mesh adjacency within zone).

## Data Flow & API Contracts

- Assign tables endpoint: src/app/api/ops/bookings/[id]/assign-tables/route.ts

## UI/UX States

- N/A (no UI changes planned)

## Edge Cases

- Adjacency required but no edges exist for tables.
- Zones with a single table cannot have self-edges (`table_adjacencies_not_equal`); those tables will remain without adjacency entries.
- Multiple Railway restaurant rows (duplicate slugs).

## Testing Strategy

- Read-only DB queries via Supabase CLI.

## Rollout

- No rollout; diagnosis only unless fix approved.

## DB Change Plan (if applicable)

- No DB writes unless explicitly approved.
