---
task: staging-perf-dataset
timestamp_utc: 2026-02-07T16:47:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Make Staging Performance-Representative

## Goal

Seed Supabase **staging** (`ndxmivcrehsacuerwxtm`) with a deterministic, non-sensitive dataset that approximates:

- **50+ restaurants** (multi-tenant)
- realistic bookings/customer cardinalities
- enough distribution to make query plans and index choices meaningful

Then replay representative queries to populate `pg_stat_statements` and capture fresh diagnostic artifacts for follow-up optimization work.

## Constraints

- Supabase is **remote-only** (no local Supabase).
- Use staging database only.
- Do not delete/truncate existing staging data; seed data must be identifiable and isolated.
- Avoid leaking secrets in artifacts.

## Existing Patterns & Reuse

- Existing staging config restaurants exist:
  - `the-old-crown-girton`, `white-horse-pub-waterbeach`, `the-railway-pub`, `the-corner-house-pub-cambridge`
- Existing scripts:
  - `scripts/check-staging-supabase.ts` connectivity check
  - `scripts/seed-railway-from-cornerhouse.ts` clones restaurant config tables (service periods, zones, inventory)
  - `scripts/seed-bookings-week-final.ts` seeds bookings (single restaurant)
- Existing ops query shapes (representative of the workload):
  - `src/app/api/ops/bookings/route.ts` bookings list + search + pagination
  - `server/ops/bookings.ts` today summary / changes

## Key Risks

- Large inserts can take time and inflate staging.
- If we seed via non-idempotent identifiers, repeated runs can create duplicates.
- Supabase CLI migrations are pipelined; `CREATE INDEX CONCURRENTLY` is not supported (not directly relevant for seeding, but impacts follow-up optimization migrations).

## Recommended Direction

- Add a deterministic seeding script that:
  - creates **seed-only** restaurants with a stable slug prefix
  - clones config from a known-good source restaurant (default: `the-old-crown-girton`)
  - seeds customers/bookings/table assignments with a stable `seed_tag` and unique reference prefixes
  - is dry-run by default and requires `--apply` to write
- Add a workload replay script that runs representative parameterized queries and writes artifacts for:
  - query timings summary
  - `pg_stat_statements` top queries (post-run)
  - table sizes, seq scans, index usage snapshots (post-run)
