---
task: grab-zones-tables-oldcrowngirton
timestamp_utc: 2026-02-08T15:10:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Export Zones + Tables (Old Crown Girton, Production)

## Requirements

- Functional:
  - Export `zones` rows for Old Crown Girton from **production**.
  - Export `table_inventory` rows for Old Crown Girton from **production**.
  - Output should be usable for later import/seed and for human review (stable ordering, includes row counts).
- Non-functional:
  - Read-only. No production writes.
  - Secrets must never be written to disk or printed to stdout.
  - Must handle >1000 rows (PostgREST paging).
  - Fail fast with clear error messages when env vars are missing or restaurant slug is wrong.

## Existing Patterns & Reuse

- `scripts/update-railway-zones-tables.ts`:
  - Uses Supabase service role key to access `restaurants`, `zones`, and `table_inventory`.
  - Establishes a pattern for restaurant id resolution via `restaurants.slug`.
- Repo policy: Supabase is remote-only (no local DB). For ad-hoc reads, use remote API via `@supabase/supabase-js`.

## Constraints & Risks

- Current environment does not have Supabase production env vars set (must be provided via shell env).
- `pg_dump`/`psql` are not available in this environment, so the export must be done via Supabase REST (supabase-js) rather than SQL dumps.
- “oldcrowngirton” could mean either:
  - The Supabase project/environment name, or
  - The restaurant slug in a shared Supabase database.
    We should support both by letting the caller set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the desired production project, and `RESTAURANT_SLUG` for the restaurant.

## Open Questions (owner, due)

- Q: What is the exact restaurant slug in `public.restaurants.slug` for Old Crown Girton in production?
  - Candidate from prior tasks: `oldcrown`.

## Recommended Direction (with rationale)

- Add a read-only export script that:
  - Connects via Supabase URL + service role key (no DB client tools required).
  - Resolves restaurant by slug.
  - Paginates and exports `zones` and `table_inventory` to JSON artifacts.
  - Emits counts + a small `meta.json` for auditing.
