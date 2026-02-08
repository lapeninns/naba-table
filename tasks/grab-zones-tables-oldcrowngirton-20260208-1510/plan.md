---
task: grab-zones-tables-oldcrowngirton
timestamp_utc: 2026-02-08T15:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Export Zones + Tables (Production)

## Objective

Export the production `zones` and `table_inventory` data for Old Crown Girton into task artifacts to enable review and later seeding/import.

## Success Criteria

- [ ] `artifacts/zones.json` contains all production `zones` rows for the target restaurant.
- [ ] `artifacts/table_inventory.json` contains all production `table_inventory` rows for the target restaurant.
- [ ] `artifacts/meta.json` includes restaurant id/slug, source supabase URL hostname (no secrets), and row counts.
- [ ] Script fails fast when required env vars are missing, and provides actionable error messages.

## Approach

- Implement `scripts/export-restaurant-zones-tables.ts`:
  - Inputs via env:
    - `NEXT_PUBLIC_SUPABASE_URL` (target production project URL)
    - `SUPABASE_SERVICE_ROLE_KEY` (service role key for that project)
    - `RESTAURANT_SLUG` (default: `oldcrown`)
    - `OUTPUT_DIR` (default: this task’s `artifacts/` dir)
    - `EXPECTED_PROJECT_REF` (optional safety check)
  - Resolve restaurant id via `restaurants.slug`.
  - Fetch all rows using paging (`range`) to avoid PostgREST limits.
  - Write stable JSON outputs sorted by:
    - zones: `sort_order`, `name`
    - table_inventory: `table_number`, `capacity`

## Testing Strategy

- Local validation:
  - Run script with missing env vars and confirm it errors without printing secrets.
  - Run script with correct env vars and confirm outputs are created and counts are non-zero (where expected).

## Rollout / Safety

- Read-only script. No production mutation.
- Optional `EXPECTED_PROJECT_REF` guard can be set to prevent accidentally exporting from the wrong Supabase project.
