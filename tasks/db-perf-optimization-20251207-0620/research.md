---
task: db-perf-optimization
timestamp_utc: 2025-12-07T06:20:52Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Database Performance Optimization

## Requirements

- Functional: propose a performance-first schema for the Supabase/Postgres backing the reservations platform (bookings, capacity allocation, holds, customers, analytics) without breaking existing RPCs and API contracts.
- Non-functional: target P95 DB latency < 200 ms for core list/fetch/mutation flows; preserve RLS/security; remote-only changes; zero data loss; migrations must be online-safe (concurrent where possible) and staged (staging → prod).

## Existing Patterns & Reuse

- Canonical schema surfaced via `types/supabase.ts` (regenerated 2025-12-03 from staging). Hot tables: `bookings`, `booking_table_assignments`, `table_holds`, `table_hold_members`, `allocations` (tsrange window), `table_inventory`, `customers`, `customer_profiles`, `analytics_events`, `waiting_list`, `observability_events`.
- RPCs used by capacity flows: `assign_tables_atomic_v2`, `confirm_hold_assignment_tx`, `sync_confirmed_assignment_windows`, `apply_booking_state_transition`, `unassign_tables_atomic`; schema changes must stay backward compatible with these signatures.
- Multi-tenant shape: nearly every table carries `restaurant_id`; most queries filter by `restaurant_id`, `booking_date`, `start_at/end_at`, and `status`.
- Range-based scheduling: `allocations.window` and `booking_table_assignments.assignment_window` use range types (typed as `unknown` in TS), suggesting GiST/exclusion index opportunities.

## External Resources

- Postgres docs (v16) on Range Types and GiST/SP-GiST indexes for overlap checks.
- Postgres "Choosing Data Types" guidance for using `timestamptz`, `int2/int4`, `text` vs `varchar`, and JSONB for semi-structured fields.

## Constraints & Risks

- Remote-only DB; avoid blocking writes on large tables—create/drop indexes concurrently.
- RLS policies must remain valid; altering PK/FK or moving columns risks policy breakage.
- Stored procedures/RPCs depend on current column names/types; altering them requires coordinated code changes and a regenerated `types/supabase.ts`.
- Unknown production row counts; new indexes may need a maintenance window if very large.

## Open Questions (owner, due)

- Current P95/P99 latencies and row counts for the hottest queries (bookings list, capacity assignment, analytics export)? (eng, before staging migration)
- Are exclusion indexes already present on `allocations.window` / `booking_table_assignments.assignment_window`? Need a schema dump to confirm. (eng, before plan sign-off)
- Target environment for first apply (staging vs prod) and allowed maintenance window length. (eng, before migration creation)

## Recommended Direction (with rationale)

- Inventory live schema via Supabase CLI dump and map query patterns from capacity code to align indexes with real filters (restaurant_id + time window + status).
- Add/reshape composite indexes (covering where helpful) on bookings, assignments, holds, allocations keyed by `restaurant_id` plus time or status; prefer partial indexes for active rows to limit bloat.
- Normalize types: ensure time columns use `timestamptz`, integer IDs sized appropriately, JSON only for optional metadata; reserve `text` for unbounded strings.
- Enforce constraints where safe: unique per-restaurant customer email/phone, not-null on critical foreign keys, check constraints on enum-like text columns if not already enums.
- Use GiST/SP-GiST + exclusion constraints for overlap detection on range columns to offload application-layer checks.
