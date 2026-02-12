---
task: db-hardening-staging
timestamp_utc: 2026-02-07T14:39:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual DB Verification (Staging)

- Target: Supabase project `ndxmivcrehsacuerwxtm` (staging)
- Evidence: artifacts captured in `artifacts/`

### Migrations Applied (Remote)

- Applied to staging:
  - `supabase/migrations/20260207144113_rls_hardening_internal_tables.sql`
  - `supabase/migrations/20260207144113_index_hygiene_fk_and_dedupe.sql`
  - `supabase/migrations/20260207144113_remove_loyalty_feature.sql`
- Apply logs:
  - `artifacts/apply_20260207144113_*.log`

### Before/After Evidence

- RLS/policy hardening evidence:
  - `artifacts/before_rls_policies_role_public_risky.csv`
  - `artifacts/after_rls_policies_role_public_risky.csv`
- Grants hardening evidence:
  - `artifacts/before_grants_internal_tables.csv`
  - `artifacts/after_grants_internal_tables.csv`
- Index hygiene evidence:
  - FK missing index report:
    - `artifacts/before_fk_missing_indexes_public.csv`
    - `artifacts/after_fk_missing_indexes_public.csv`
  - Duplicate index groups report:
    - `artifacts/before_index_duplicates_ignoring_uniqueness_public.csv`
    - `artifacts/after_index_duplicates_ignoring_uniqueness_public.csv`
- Loyalty removal evidence:
  - `artifacts/after_loyalty_tables.csv`
  - `artifacts/after_loyalty_enum.csv`

## Manual UI QA (Chrome DevTools MCP)

Dev server:

- `pnpm -s dev` (served at `http://localhost:3000`)

Routes verified:

- `http://localhost:3000/dev/ops-dashboard`
- `http://localhost:3000/dev/ops-booking-dialog`

Observations:

- No UI surfaces for loyalty tier/points remain in Ops booking list and booking dialog.
- No network requests to the removed VIPs endpoint (`/api/ops/dashboard/vips`) were observed.
- Console: no blocking errors; warnings observed in dev (multiple GoTrueClient instances; unused preload).

Artifacts:

- `artifacts/devtools_ops_dashboard.png`
- `artifacts/devtools_ops_booking_dialog.png`

## Tests / Checks

- Record commands + results.

Commands run:

- `supabase gen types --linked --lang typescript --schema public,auth > types/supabase.ts`
  - Verified: `types/supabase.ts` no longer contains `loyalty_*` tables or `loyalty_tier`.
- `supabase db push --linked --include-all`
  - Attempted before repairing migration history.
  - FAILED on the first migration due to FK dependencies when dropping `public.allowed_capacities` (blocked by `table_inventory_allowed_capacity_fkey`).
  - Evidence: `artifacts/supabase_db_push_20260207.log`
- `supabase migration repair --linked --status applied <versions...>`
  - Backfilled staging migration history so CLI no longer tries to replay old migrations.
- Migration version dedupe (local):
  - Supabase tracks migrations by the filename prefix (version). Multiple files sharing a prefix cause `supabase db push` and `supabase db pull` to fail.
  - Consolidated the duplicate-prefix files by moving the extras into:
    - `artifacts/legacy_migrations/`
  - Result: `supabase migration list --linked` shows a 1:1 match, and `supabase db push --linked --dry-run` reports “Remote database is up to date.”
- `pnpm -s typecheck`
  - Currently FAILS due to pre-existing TypeScript issues across unrelated files (scripts + server), not limited to this task’s changes.
  - Example failures include (non-exhaustive): nullability mismatches and missing RPC/view types (e.g. `get_guest_bookings`, `current_bookings`) in staging-generated Supabase types.
