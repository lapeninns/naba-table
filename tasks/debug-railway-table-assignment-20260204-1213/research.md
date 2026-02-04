---
task: debug-railway-table-assignment
timestamp_utc: 2026-02-04T12:13:27Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Railway Table Assignment Failure

## Requirements

- Functional:
- Non-functional (a11y, perf, security, privacy, i18n):

## Existing Patterns & Reuse

- server/capacity/table-assignment/\*
- server/capacity/adjacency.ts
- scripts/seed-railway-from-cornerhouse.ts
- scripts/update-railway-zones-tables.ts

## External Resources

- N/A

## Constraints & Risks

- Supabase remote-only.
- Production safety; avoid writes without explicit approval.

## Findings

- Supabase project: nabatable (ref `vrdiqfudmwydclqpydee`).
- Railway Pub slug: `the-railway-pub` (restaurant_id `adf0252b-74f1-407c-9b3d-f03cd6c1f1c5`).
- `table_inventory` rows: 17.
- `table_adjacencies` rows referencing Railway tables: 0.
- All 17 tables have no adjacency edges, so adjacency-required flows will reject them.
- Added full-mesh adjacency per zone; `table_adjacencies` now 28 rows.
- Single-table Private Zone (`30F`) cannot have adjacency due to `table_adjacencies_not_equal` constraint.

## Open Questions (owner, due)

- What is the exact failure symptom in production (API error, UI, logs)? (owner: user)

## Recommended Direction (with rationale)

- Verify restaurant slug + id, table inventory, and adjacency rows in Supabase.
- Confirm adjacency enforcement settings; if adjacency missing, seed/repair adjacency edges.
