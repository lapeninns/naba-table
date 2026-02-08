---
task: db-optimization-analysis
timestamp_utc: 2026-02-07T16:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Database Optimization & Enhancement Report (Staging-Backed)

## Context Provided

- Target scale: **50+ restaurants** (multi-tenant OLTP).
- Database platform: **Supabase Postgres** (staging project `ndxmivcrehsacuerwxtm`).
- Preferred migration approach: **Option A (baseline + forward-only migrations)**, no legacy migration history imported.
- Tooling preference: **Supabase CLI** for migrations, staging-first, production after tests.

## Data Sources / Evidence

1. Pre-change diagnostic artifacts collected on **2026-02-07 ~14:08 UTC**:
   - `artifacts/staging_db_diagnostics.txt`
   - `artifacts/pg_stat_statements_*.csv`
   - `artifacts/index_*_public.csv`, `artifacts/fk_missing_indexes_public.csv`
   - `artifacts/rls_policies_*.csv`, `artifacts/table_grants_public.csv`
2. Post-change spot checks executed after migrations were applied (safe catalog queries; no secrets stored).
3. Post-seed, performance-representative staging dataset (created **2026-02-07 16:56 UTC**):
   - Task: `tasks/staging-perf-dataset-20260207-1647/`
   - Seed totals (from `tasks/staging-perf-dataset-20260207-1647/artifacts/seed-summary.json`):
     - 50 seed restaurants
     - 12,500 customers
     - 16,500 bookings
     - 6,665 table assignments
   - Workload replay + timings:
     - `tasks/staging-perf-dataset-20260207-1647/artifacts/workload-timings.json`
     - `tasks/staging-perf-dataset-20260207-1647/artifacts/pg_stat_statements_top_*.csv`
     - `tasks/staging-perf-dataset-20260207-1647/artifacts/pg_stat_statements_oltp_select_top_*.csv` (read-path focused)

## Executive Summary (Prioritized)

### What’s Already Implemented On Staging (High Value Wins)

These were implemented via migrations already present in this branch:

- **Security hardening for internal tables** (RLS + privilege revokes).
  - Migration: `supabase/migrations/20260207144113_rls_hardening_internal_tables.sql`
  - Impact: removes the most dangerous class of misconfigurations found in the pre-change artifacts (policies effectively open to `public`).
- **Index hygiene**:
  - Added many FK-supporting indexes.
  - Removed duplicate/redundant indexes to reduce write amplification and bloat.
- **Loyalty removal (schema)**:
  - Product confirmed loyalty is permanently deprecated.
  - Loyalty tables are now absent on staging (validated by a post-change table scan).

### What Still Needs Doing (Before Production)

P0 (Security / correctness)

- **Confirm production RLS/grants match staging** after baselining (Option A) and before any traffic is pointed at the updated schema.
- **Confirm “public” policies are intentional**:
  - Remaining “qual=true” policies on staging are:
    - `booking_occasions` (public read),
    - `merge_rules` (read),
    - `leads` (public insert).
  - These may be correct, but should be explicitly reviewed and documented.

P1 (Operational safety)

- **Production rollout plan for non-CONCURRENT index builds/drops**
  - Constraint: Supabase CLI `db push` does not support `CREATE/DROP INDEX CONCURRENTLY` due to pipelined execution.
  - Implication: large index builds/drops must run in a change window (or use an approved non-pipelined workflow).
- **Define RPO/RTO + run restore drills** (business continuity).

P2 (Performance / scalability)

- Initial staging snapshot was tiny (≈14 MB). We have since seeded staging with a production-shaped dataset (50 seed restaurants, 16,500 bookings) and replayed representative queries to produce post-run `pg_stat_statements` and timing artifacts. Staging is now useful for query/index validation, but still may not match production distributions/traffic.

## Cost-Benefit Summary (Major Changes)

| Change                                                             | Benefit                                     | Cost              | Risk                                       | Status              |
| ------------------------------------------------------------------ | ------------------------------------------- | ----------------- | ------------------------------------------ | ------------------- |
| Fix “open” RLS policies + revoke client grants for internal tables | Prevents data exposure                      | Low               | Medium-High (can break access if mistaken) | **Done on staging** |
| Add missing FK indexes                                             | Prevents FK scans/lock stalls; faster joins | Low               | Low                                        | **Mostly done**     |
| Drop redundant/duplicate indexes                                   | Lower write cost; smaller bloat/backups     | Medium (validate) | Medium                                     | **Done on staging** |
| Trigram/FTS indexes for search endpoints                           | Big p95 improvements for “contains” search  | Medium            | Medium                                     | Recommended         |
| Retention + partitioning for logs/events/history                   | Predictable performance as data grows       | High              | High                                       | Recommended later   |

## Roadmap (Effort Estimates)

Quick wins (1-3 days total, staging-first):

1. **Production baseline + dry-run discipline (Option A)** (S)
2. **Post-change security verification** (S-M)
3. **Seed staging with production-like data** (M)
4. **Search index strategy (pg_trgm/FTS) for ops search pages** (M)

Longer-term (1-4+ weeks):

1. Retention automation (`pg_cron`) for append-only tables (M-L)
2. Partitioning for very large append-only tables (L-XL)
3. Read replicas / caching layer for read-heavy ops workloads (M-L)

## Before/After Performance Projections (Directional)

Because production distributions and concurrency can differ from staging, these projections remain directional and must be validated under production-like load (or production read replicas / controlled rollout):

- Index dedupe: expect reduced write amplification on core tables proportional to number of indexes removed (commonly 10-30% improvement on write-heavy paths when heavily over-indexed).
- FK index coverage: worst-case FK checks move from table scans to index lookups, reducing lock time spikes during deletes/updates and improving join shapes.
- Search indexes (trigram/FTS): “contains” search can move from scans (seconds at scale) to index-assisted lookups (tens of ms), at the cost of extra write/storage.

---

# Detailed Findings & Recommendations

## 1) Current State Assessment

### Findings (Staging, Post-Change)

- Database: **PostgreSQL 17.6** (Supabase hosted).
- Region hint (from pooler hostname): **AWS eu-west-2** (London). (Useful for latency expectations.)
- Approx size: **~14 MB**.
- Public schema object counts: **47 tables**, **198 indexes**, **0 views**, **0 matviews**.
- Key settings (selected):
  - `max_connections=60`
  - `shared_buffers=256 MB`, `effective_cache_size≈768 MB`
  - `work_mem≈3.5 MB`, `maintenance_work_mem≈64 MB`
  - `statement_timeout=120s`
  - `lock_timeout=0` and `idle_in_transaction_session_timeout=0` (disabled)
  - `autovacuum=on` with defaults (`vacuum_scale_factor=0.2`, `analyze_scale_factor=0.1`)

### Recommendations

- Treat staging as both:
  - **schema correctness + security regression environment** (now), and
  - **performance validation environment** (after seeding realistic data).
- Set basic safety timeouts per role (not necessarily instance-wide):
  - `idle_in_transaction_session_timeout` to prevent “stuck tx” incidents.
  - `lock_timeout` to avoid cascading latency during DDL or heavy writes.

## 2) Query Performance Analysis

### Findings

- `pg_stat_statements` is enabled (good).
- Pre-seed snapshots were heavily influenced by maintenance/utility queries due to low data volume.
- Post-seed artifacts now include a workload replay window with 50 restaurants and 16.5k bookings; use those artifacts for prioritization.
- Workload timing summary (from `tasks/staging-perf-dataset-20260207-1647/artifacts/workload-timings.json`):
  - `ops_bookings_list_range`: mean ~65ms, worst chunk p95 ~154ms (150 runs)
  - `ops_bookings_list_search`: mean ~70ms, worst chunk p95 ~172ms (150 runs)
  - `ops_today_summary`: mean ~86ms, worst chunk p95 ~275ms (50 runs)
- Application queries appear parameterized in practice (good for plan caching and injection safety).

### Recommendations

- Make query analysis real:
  - Seed staging with realistic data.
  - Run scripted ops flows that match peak-hour behavior (search, booking creation, assignment, holds).
  - Re-collect `pg_stat_statements` and analyze top-by-total and top-by-mean.
- For any query that becomes a p95 driver, require:
  - `EXPLAIN (ANALYZE, BUFFERS)` on staging with representative data
  - a corresponding index/schema fix or query rewrite (avoid “just increase timeouts”).

## 3) Indexing Strategy

### Findings

- Pre-change artifacts showed:
  - many redundant indexes (write amplification),
  - missing FK-supporting indexes (FK checks risk),
  - duplicate index definitions.
- These were largely addressed by the hardening migration(s).

### Recommendations

- Standardize the index rules for multi-tenant OLTP:
  - Every frequently queried table should have an index that starts with `restaurant_id` if the access pattern is restaurant-scoped.
  - Every FK used in joins (or frequently updated/deleted) should have a supporting index (or a documented partial index for nullable FKs).
- Search endpoints:
  - if you do `ilike '%term%'`, plan `pg_trgm` indexes on the exact searched column(s).

## 4) Schema Design Evaluation

### Findings

- Schema is broadly normalized and uses Postgres features effectively (enums, generated normalized columns, range types).
- Largest schema risk observed earlier: **drift** (tables referenced in code not existing in DB, or deprecated features still present in schema).
  - Loyalty is now removed from staging schema, reducing drift.

### Recommendations

- Tighten “schema as single source of truth”:
  - If code references a view/table/function, it must be created via migrations in this repo.
  - If a feature is dead (loyalty), remove it in both DB and code, and remove any generated types that reference it.
- Avoid premature denormalization.
  - At 50 restaurants, most performance wins will come from good indexes and query shapes, not denormalization.

## 5) Configuration & Tuning

### Findings

- No global `log_min_duration_statement` is enabled (no slow query log at the DB layer by default).
- Global timeouts for locks and idle-in-tx are not enabled.
- Supabase provides pooler access; pooled connections are sensitive to long transactions and session-level settings.

### Recommendations (Pragmatic, Supabase-Friendly)

- Prefer **role-level settings** to instance-level where possible:
  - `ALTER ROLE authenticator SET statement_timeout = '60s';` (example)
  - `ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '60s';`
- Enable slow query logging only in controlled windows (staging first):
  - `log_min_duration_statement` at a threshold (e.g., 250ms or 500ms) for a short period.
- If you need deeper visibility:
  - consider enabling `auto_explain` for statements exceeding a threshold (staging-first, avoid log explosion).

## 6) Concurrency & Locking

### Findings

- Staging shows no deadlocks in the pre-change snapshot.
- Configuration has no global lock/idle-in-tx guardrails enabled.

### Recommendations

- Prevent “bad session hygiene” from becoming incidents:
  - ensure application-level transactions are short and bounded.
  - enforce timeouts at role level (recommended) to prevent forgotten open transactions.
- For DDL (migrations):
  - use `lock_timeout` and schedule production changes that involve index builds/drops in a change window (see migration tooling constraint).

## 7) Data Integrity & Consistency

### Findings

- Core OLTP tables have PKs and multiple FKs, which is good for consistency.
- The main integrity risk in restaurant systems is not “missing constraints”, it’s:
  - tenant boundary errors (`restaurant_id` mixups),
  - duplicate customer identities (email/phone normalization),
  - missing idempotency on write APIs.

### Recommendations

- Keep tenant boundaries enforceable at DB level:
  - prefer `(restaurant_id, <business_key>)` uniqueness constraints for tenant-scoped entities.
- Formalize idempotency keys for external-facing booking creation flows (if not already).
- Add “data quality” checks that run on a schedule (staging first, then prod):
  - orphan rows (should be impossible with FK, but verify),
  - duplicate customers per restaurant (normalized email/phone),
  - bookings with inconsistent time ranges.

## 8) Backup & Recovery

### Findings

- WAL archiving is enabled on staging; Supabase supports PITR on eligible plans.
- RPO/RTO targets are currently unspecified (must be defined to evaluate readiness).

### Recommendations

- Define business targets:
  - Example starting point:
    - RPO: 15 minutes
    - RTO: 2 hours
  - Adjust based on operational reality and plan constraints.
- Run restore drills on staging:
  - document steps, time-to-restore, and validation queries.

## 9) Security & Compliance

### Findings

- The highest-risk security issue (open internal table policies) has been addressed on staging via migrations.
- Remaining “public” policies should be explicitly reviewed and documented as intended.
- Reservation systems hold PII (name/email/phone) even if payment is out of scope.

### Recommendations

- Enforce least privilege:
  - revoke table privileges from `anon`/`authenticated` for internal tables (already done on staging).
  - keep RLS policies minimal and explicit.
- Compliance posture:
  - treat customer contact fields as PII and ensure access is scoped by restaurant membership.
  - retain audit logs with a defined retention policy (don’t keep forever by accident).

## 10) Monitoring & Observability

### Findings

- Key extensions are preloaded (pg_stat_statements, auto_explain, pgaudit, pg_cron).
- There is no explicit alerting described yet (must be implemented at the ops layer).

### Recommendations

Minimum dashboards/alerts before production expansion:

- DB health:
  - connection saturation, lock waits, long transactions, dead tuples/autovacuum lag
- Query performance:
  - top total time queries, p95 latency on critical endpoints (app-side)
- Error rate:
  - PostgREST error spikes, RLS violations (if surfaced)

## 11) Scalability Considerations (50+ Restaurants)

### Findings

- The biggest scaling driver is multi-tenant OLTP query patterns and hot tables (bookings, holds, assignments).

### Recommendations

- Avoid sharding early.
  - At 50 restaurants, a single well-indexed Postgres instance should be fine.
- Scale by:
  - query/index tuning + caching for read-heavy endpoints,
  - read replicas if reporting/analytics queries start to contend with OLTP,
  - partitioning only once append-only tables become large enough to justify the complexity.

## 12) Maintenance Procedures

### Findings

- Autovacuum is on (default).
- No explicit retention automation is defined for log/event/history tables.

### Recommendations

- Add a maintenance SOP (staging-first):
  - monthly review of `pg_stat_user_tables` dead tuples and index bloat indicators
  - routine review of index growth for event/log tables
- Define retention:
  - e.g. keep audit logs 90 days unless compliance needs longer
  - prune analytics/events tables if they are used only for debugging and not product analytics

---

# Implementation Notes: Migrations With No History (Option A)

You can safely migrate a “fresh clone of production” staging database without importing legacy migration history by:

1. Baselining the migration history to a known version (do not replay legacy SQL-editor changes).
2. Applying forward-only migrations from this branch.

Canonical runbook: `docs/db/supabase-baseline-migrations.md`.
