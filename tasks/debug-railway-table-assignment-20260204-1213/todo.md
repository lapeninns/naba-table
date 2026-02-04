---
task: debug-railway-table-assignment
timestamp_utc: 2026-02-04T12:13:27Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm Supabase project ref for Railway production
- [ ] Confirm Railway Pub slug / restaurant_id

## Core

- [x] Query table_inventory and table_adjacencies counts
- [x] Verify adjacency requirement settings
- [x] Build full-mesh adjacency per zone (skip single-table zones)
- [x] Apply adjacency insert for Railway Pub (production)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Which environment is affected (prod/staging)?
