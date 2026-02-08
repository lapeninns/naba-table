---
task: db-optimization-analysis
timestamp_utc: 2026-02-07T14:02:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Database Optimization & Enhancement Analysis

## Goal

Produce a comprehensive, staging-backed assessment of the Supabase Postgres database (current state, performance, indexing, schema, security) and deliver prioritized recommendations + an implementation roadmap.

## Scope

- Target environment: **staging** Supabase project `ndxmivcrehsacuerwxtm`.
- Access method: Supabase CLI (linked) + Postgres client queries.
- Output: exec summary + detailed findings + roadmap (see `plan.md`).
  - Scale target (product input, 2026-02-07): **50+ restaurants**.
  - Workload type: OLTP / multi-tenant (restaurant-scoped).

## Non-goals

- No schema changes or data migrations in this task.
- No production database access.

## Context From Product/Engineering

- Scale: targeting **50+ restaurants**.
- RPO/RTO: **unknown** (needs definition).
- Loyalty: **not coming back** (safe to plan full removal of schema + code, but requires an explicit implementation task).
- Latency SLOs: none currently defined (recommend establishing at least p95 targets for ops list/search and booking creation).

## Executive Summary (Prioritized Recommendations)

> Update (2026-02-07): Several P0/P1 items identified in this research were subsequently implemented on staging
> via migrations in this branch (notably `20260207144113_rls_hardening_internal_tables.sql` and
> `20260207170000_add_remaining_fk_indexes.sql`). The authoritative, current summary lives in `report.md`.

### P0 (Immediate): Security / Data Exposure Risk

- **Fix RLS policies that are effectively open to all users (`TO public` + `ALL` + `qual=true`).**
  - Affected tables (staging): `audit_logs`, `booking_assignment_idempotency`, `feature_flag_overrides`, `table_hold_windows`, `loyalty_points`, `loyalty_programs`, `loyalty_point_events`.
  - Why this matters: combined with broad table grants, these policies can allow `anon` / `authenticated` clients to read and mutate internal tables.
  - Artifact: `artifacts/rls_policies_role_public_risky.csv` (see rows with `cmd=ALL` and `qual=true`).

### P1 (Near-term): Performance / Cost (Write Amplification + Planner Noise)

- **Deduplicate redundant indexes.**
  - True duplicates (same definition) exist (e.g., multiple indexes on `booking_table_assignments(booking_id)` and `audit_logs(entity, entity_id)`).
  - Redundant pairs exist where a **unique index already covers** a separate non-unique index (e.g., `bookings(reference)`, `restaurants(slug)`, `customers(restaurant_id,email_normalized)`).
  - Benefit: lower write cost (INSERT/UPDATE/DELETE), less bloat, faster vacuums, smaller backups.
  - Artifacts: `artifacts/index_duplicates_public.csv`, `artifacts/index_duplicates_ignoring_uniqueness_public.csv`.

- **Add missing btree indexes on foreign key columns that are not index-backed.**
  - Benefit: prevents FK checks from degenerating into table scans; reduces lock time during deletes/updates; improves join performance.
  - Artifact: `artifacts/fk_missing_indexes_public.csv` (19 FK constraints lacking a supporting prefix index).

### P2 (Strategic): Scalability / Operability

- **Make staging representative** (schema + data) for meaningful performance baselines.
  - Current staging DB is small (≈14 MB) and `pg_stat_statements` is dominated by utility/maintenance queries; runtime bottlenecks for real traffic cannot be inferred reliably.
  - Artifact: `artifacts/staging_db_diagnostics.txt`, `artifacts/pg_stat_statements_oltp_top_mean.csv`.

- **Define RPO/RTO and verify that backups + restore procedures meet them.**
  - This is not optional at 50+ restaurants: operational incidents become frequent enough that restore time and data loss tolerance materially affect the business.

- **Remove loyalty fully (schema + code) to reduce surface area and security risk.**
  - Current state is inconsistent (stubs in code vs tables/policies present in DB), which increases risk of accidental exposure and maintenance overhead.

- **Add search-appropriate indexes (trigram / FTS) for user-facing “contains” search** if these endpoints are used at scale.
  - Example patterns in code: `ilike '%term%'` across customer name/email/phone and bookings search.
  - This is a “pay for what you use” change: adds index/storage and write cost, but can cut p95 search latency drastically.

- **Plan retention/partitioning for “event/log/history/outbox” tables** once data volume grows.
  - Candidates: `audit_logs`, `analytics_events`, `email_delivery_log`, `booking_state_history`, `booking_versions`, `capacity_outbox`, `observability_events`.

## Key Gaps / Limitations (Staging-Only Constraint)

- **Staging data volume is tiny** and does not reflect production cardinalities, distribution, or contention; any “response time baseline” is mostly noise.
- Structural findings (schema, indexes, RLS policies, grants, config defaults) remain actionable and are the main focus of this report.

## Evidence (Artifacts)

- DB snapshot: `artifacts/staging_db_diagnostics.txt`
- Query stats: `artifacts/pg_stat_statements_oltp_top_mean.csv`, `artifacts/pg_stat_statements_oltp_top_total.csv`, `artifacts/pg_stat_statements_oltp_top_calls.csv`
- Table scan stats: `artifacts/table_scan_stats_public.csv`
- Index audit:
  - `artifacts/index_usage_public.csv`
  - `artifacts/index_unused_public.csv` (staging traffic is not representative; treat as informational only)
  - `artifacts/index_duplicates_public.csv`
  - `artifacts/index_duplicates_ignoring_uniqueness_public.csv`
  - `artifacts/fk_missing_indexes_public.csv`
- Schema snapshot: `artifacts/public_schema_dump.sql`
- Security:
  - `artifacts/table_grants_public.csv`
  - `artifacts/rls_policies_public.csv`
  - `artifacts/rls_policies_role_public.csv`
  - `artifacts/rls_policies_role_public_risky.csv`
- Config + WAL/logging:
  - `artifacts/wal_backup_logging_settings.csv`
  - `artifacts/observability_settings.csv`
  - `artifacts/supabase_postgres_config_overrides.json`
  - `artifacts/roles.csv`

---

# Detailed Analysis (by requested category)

## 1. Current State Assessment

### Findings

- **Database type/version**: Supabase-hosted PostgreSQL **17.6**.
- **Architecture**: single primary; accessed via Supabase pooler in this analysis.
- **Size (staging)**: ~**14 MB** total database size.
- **Object counts (public schema)**: ~**50 tables**, **209 indexes**.
- **Selected config**:
  - `max_connections=60`
  - `shared_buffers=256 MB`, `effective_cache_size≈768 MB` (inferred from `8kB` units)
  - `statement_timeout=120s`
  - `lock_timeout=0` and `idle_in_transaction_session_timeout=0` (disabled)
  - WAL archiving enabled (`archive_mode=on`)
- **Baseline health**:
  - `deadlocks=0` since `stats_reset` (2025-12-08 UTC).
  - cache hit ratio in staging is extremely high (~99.992%), which is expected for a small working set.

### Recommendations

- Treat staging as a **schema correctness + safety** environment; for performance optimization work, create a plan to make staging **production-like** (row counts, skew, and typical read/write mix).
- Add sane global guardrails:
  - Consider a non-zero `lock_timeout` (e.g., 5s) and `idle_in_transaction_session_timeout` (e.g., 60s) to prevent “stuck” sessions and cascading latency under load.
  - Keep the strict `statement_timeout`, but consider lowering it for OLTP request paths (or set per-role/per-connection in the app) once you have real latency budgets.

## 2. Query Performance Analysis

### Findings

- `pg_stat_statements` is enabled and persisted (`pg_stat_statements.save=on`).
- In staging, the highest-latency statements are dominated by **utility/maintenance** and **schema/dump** operations (e.g., `COPY`, replication, schema inspection).
- Application queries observed in code are generally **parameterized** (queries show `$1`, `$2`, etc), which is good for plan stability and injection safety.

### Recommendations

- For meaningful “slow query” work:
  - Capture a **production-like staging workload** (replay anonymized queries or seed data + scripted flows).
  - Re-capture `pg_stat_statements` after the workload window.
- Consider enabling richer “slow query explain” during short windows:
  - `auto_explain.log_analyze=on` and `auto_explain.log_buffers=on` (staging first) for queries that exceed a threshold; keep the threshold high enough to avoid log spam.
- Identify and optimize these query patterns in the app:
  - `ilike '%term%'` searches (needs trigram/FTS, see §3/§11).
  - wide embedded selects with multiple nested relationships: ensure FK indexes and avoid unnecessary columns.

## 3. Indexing Strategy

### Findings

- Multiple **duplicate / redundant indexes** exist in the public schema:
  - Exact duplicates: `audit_logs(entity, entity_id)` and several others.
  - “Covered by unique” redundancy: non-unique indexes exist where unique constraints already provide a btree index (e.g., `restaurants(slug)`).
- Some **foreign keys lack supporting btree indexes** (19 constraints in staging). This is a classic source of:
  - slow deletes/updates on referenced rows
  - long lock holds during FK checks
  - unnecessary sequential scans

### Recommendations

- Index cleanup should be **data-driven**:
  - Verify index usage on production-like workload before dropping.
  - Drop redundant indexes (prefer `DROP INDEX CONCURRENTLY` in production windows).
- Add missing FK indexes proactively (low-risk, high upside), especially for high-churn tables (assignments, holds, outbox).

## 4. Schema Design Evaluation

### Findings

- Schema uses several Postgres-native strengths:
  - enums for statuses/types
  - generated columns for normalized email/phone (`customers`)
  - GiST index for range overlap queries (`allocations(window)`).
- There is **schema drift / mismatched expectations** between application and staging database:
  - `current_bookings` appears in generated Supabase types and is used in code, but does not exist in staging.
  - Code contains loyalty “disabled stubs” while the staging schema still includes `loyalty_*` tables.

### Recommendations

- Reconcile schema drift as a prerequisite for optimization:
  - Ensure all relations used in code exist via migrations, or remove/replace the code paths.
  - Decide whether loyalty is truly deprecated (drop DB tables + remove stubs) or should be re-enabled (finish implementation + policies).
- Consider long-term schema enhancements:
  - add retention/partitioning strategy for “event/history/log” tables (see §12).
  - ensure all relationships have correctly indexed FK columns (see §3).

## 5. Configuration & Tuning

### Findings

- No Supabase config overrides are set (CLI returns `{}`), so the instance is running on plan defaults.
- Observability extensions are preloaded (`pg_stat_statements`, `auto_explain`, `pgaudit`) but detailed slow-query explain is currently limited (`auto_explain.log_analyze=off`).

### Recommendations

- Add a “tuning” layer that is intentional:
  - Set guardrail timeouts (lock, idle-in-tx).
  - Tune autovacuum per high-churn tables (lower scale factors) once row counts exist.
- Keep `track_io_timing` off by default; enable temporarily during focused investigations if you need read/write timing.

## 6. Concurrency & Locking

### Findings

- No lock waits were present at the time of snapshot (staging), and deadlocks are 0 since last stats reset.
- The domain includes “holds” and “assignments”, which are inherently concurrency-sensitive and typically require careful transaction and constraint design.

### Recommendations

- Ensure “atomic hold/assignment” paths:
  - keep transactions short
  - use deterministic lock ordering
  - enforce idempotency at the database boundary (unique constraints + consistent conflict handling)
- Add a non-zero `lock_timeout` to fail fast on lock contention; use structured error mapping in the app to surface “please retry” flows.

## 7. Data Integrity & Consistency

### Findings

- There is healthy usage of constraints (PK/UK/FK/CHECK) across the main tables.
- Several FK columns are not index-backed (see §3).

### Recommendations

- Add missing FK indexes (priority).
- Where business rules are strict (e.g., “unique per restaurant per day/time”), prefer enforcing them with:
  - unique constraints (where feasible)
  - check constraints for invariant ranges (already in use for counts).

## 8. Backup & Recovery

### Findings

- WAL archiving is enabled (`archive_mode=on`) and archive command is configured; this suggests PITR capability is available on the platform side.

### Recommendations

- Define explicit RPO/RTO targets (minutes/hours) and match them to your Supabase plan capabilities.
- Run periodic restore drills (staging restore from backup) and document the procedure.

## 9. Security & Compliance

### Findings

- **Critical**: multiple internal tables have “public allow-all” RLS policies (see P0 list above).
- Table grants in public schema appear broad (typical Supabase pattern): `anon` and `authenticated` have privileges, relying on RLS to enforce tenant boundaries.

### Recommendations

- Fix the allow-all policies first:
  - tighten `TO` roles to `service_role` for internal tables
  - ensure `anon` cannot read/mutate internal operational tables
- Then do a broader RLS review:
  - replace `TO public` with explicit `TO authenticated` or `TO anon, authenticated` where appropriate
  - ensure every policy is “least privilege” and matches app access patterns
- For compliance: classify PII columns (email/phone) and ensure:
  - RLS policies and service-role usage paths are audited
  - logs do not store sensitive payloads unnecessarily (or are redacted).

## 10. Monitoring & Observability

### Findings

- `pg_stat_statements` is enabled and saved; max tracked statements is 5000.
- `auto_explain.log_min_duration=10s` but lacks analyze/buffers data.
- Logging captures DDL and lock waits; slow-statement logging is disabled.

### Recommendations

- Establish a standard DB observability pack:
  - weekly review of top queries by total time, mean time, and calls
  - alerts on deadlocks, lock waits, replication lag, and connection saturation
- For deep dives, temporarily enable:
  - `auto_explain.log_analyze=on`, `auto_explain.log_buffers=on` (staging first, short windows)

## 11. Scalability Considerations

### Findings

- Application query patterns are mostly OLTP and restaurant-scoped; scaling pain will primarily come from:
  - booking volume growth
  - high churn “hold/assignment” tables
  - growing logs/events tables
  - contains-search patterns (`ilike '%...%'`)

### Recommendations

- Favor these scaling levers (in order):
  1. Fix security + correctness drift (precondition)
  2. Index hygiene (dedupe + FK indexes)
  3. Search indexes (trigram/FTS) for user-facing search
  4. Retention/partitioning for large append-only tables
  5. Caching for hot read paths (Redis) and potentially read replicas if needed

## 12. Maintenance Procedures

### Findings

- Autovacuum/analyze timestamps are mostly empty in staging (expected with minimal data).
- Index count is relatively high for the number of tables (index redundancy present).

### Recommendations

- Add a regular maintenance cadence:
  - periodic review of index redundancy
  - ensure stats (`ANALYZE`) are current for large tables
  - vacuum strategy for high churn tables (potential per-table settings)
- Implement retention jobs (likely via `pg_cron`) for log/event tables once volume grows.
