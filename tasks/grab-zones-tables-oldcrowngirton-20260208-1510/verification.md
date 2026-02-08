---
task: grab-zones-tables-oldcrowngirton
timestamp_utc: 2026-02-08T15:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Execution

- Command:
  - `RESTAURANT_SLUG=the-old-crown-girton OUTPUT_DIR=tasks/grab-zones-tables-oldcrowngirton-20260208-1510/artifacts pnpm exec tsx scripts/export-restaurant-zones-tables.ts`
- Result:
  - Success (2026-02-08): exported `zones` and `table_inventory` for restaurant slug `the-old-crown-girton`.
  - Counts:
    - `zones`: 4
    - `table_inventory`: 26

## Artifacts

- `artifacts/zones.json`
- `artifacts/table_inventory.json`
- `artifacts/meta.json`
