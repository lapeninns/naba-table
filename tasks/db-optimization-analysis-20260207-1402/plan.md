---
task: db-optimization-analysis
timestamp_utc: 2026-02-07T14:02:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan: Database Optimization & Enhancement

## Objective

Turn the findings from `research.md` into a staged, low-risk optimization roadmap (quick wins first, then structural improvements), including verification steps and rollback strategies.

## Success Criteria (Measurable)

- Security:
  - No internal tables are writable/readable by unintended roles (`anon`/`authenticated`) via RLS misconfiguration.
  - Tenant boundaries remain enforced for all `public` tables exposed through PostgREST.
- Performance:
  - Reduced write amplification on core OLTP tables (fewer redundant indexes).
  - FK enforcement does not cause sequential scans on large referencing tables (FK columns index-backed).
  - Search endpoints remain <500ms p95 under target concurrency with realistic datasets.
- Operability:
  - Staging is representative enough to validate performance changes (schema parity + seeded data).
  - Before/after evidence captured in task artifacts for every DB change.
  - Backups and restores have defined RPO/RTO targets (even if initially coarse) and a documented restore drill.

## Rollout Principles

- Staging-first; production changes only after staging evidence.
- Prefer additive/index-only changes first; avoid blocking DDL during peak hours.
- Measure before/after with query stats + representative app flows.

## Roadmap (High Level)

1. Baseline and observability (pg_stat_statements, dashboards, alerting)
2. Query + index improvements (targeted, measurable)
3. Schema and integrity improvements (constraints, FKs, types)
4. Concurrency/locking hardening (timeouts, transaction scopes)
5. Long-term scalability (partitioning, caching, read replicas)

## Roadmap (Detailed)

### Phase 0: Preconditions (Staging Parity)

Goal: ensure staging is a safe but useful environment to validate changes.

- Confirm schema parity with the deployed app:
  - Fix drift where code references relations missing from staging (e.g., `current_bookings`).
  - Reconcile deprecated features (loyalty stubs vs `loyalty_*` tables in DB).
- Seed staging with a **non-sensitive dataset** that matches production-ish cardinalities:
  - bookings per restaurant per day
  - customers per restaurant
  - assignments/holds churn
  - logs/events volume

Scale input: targeting **50+ restaurants** (2026-02-07). Design staging seed cardinalities accordingly.

Effort: M (1-3 days) depending on data generation approach.
Risk: Low (staging-only).

### Phase 1: Security Hardening (P0)

Goal: eliminate “open access” RLS policies and enforce least privilege.

- Fix RLS policies that are effectively `ALLOW ALL` for `public` role:
  - `audit_logs`
  - `booking_assignment_idempotency`
  - `feature_flag_overrides`
  - `table_hold_windows`
  - `loyalty_points`, `loyalty_programs`, `loyalty_point_events`
- Convert broad `TO public` policies to explicit roles where appropriate:
  - staff-only tables: `TO authenticated`
  - truly public read-only tables: `TO anon, authenticated`
  - internal-only tables: `TO service_role`
- Verification:
  - From an `anon` client token: assert read/write are denied for internal tables.
  - From an `authenticated` token with/without membership: assert correct allow/deny.

Effort: S-M (0.5-2 days).
Risk: High (misconfig can break ops flows or expose data). Staging-first mandatory.

Rollback: revert policy changes (policy DDL is reversible); keep a copy of prior policy definitions.

### Phase 2: Index Hygiene (P1)

Goal: reduce index redundancy and ensure FK enforcement performance.

1. Add missing FK-supporting btree indexes (safe additive):
   - Create indexes concurrently where possible.
   - Prioritize high-churn tables: holds, assignments, outbox, audit.

Effort: S (0.5-1 day).
Risk: Low.

2. Remove redundant/duplicate indexes (requires verification):
   - Exact duplicates: drop the one with lower usage / older naming.
   - Redundant “covered by unique/PK”: drop non-unique indexes that duplicate unique constraints.
   - Run on staging first, then production during a window.

Effort: M (1-3 days) including validation.
Risk: Medium (dropping an index can regress performance if assumptions are wrong).

Rollback: recreate dropped index concurrently (keep DDL scripts).

### Phase 2.5: Remove Loyalty (P1/P2, Given “Not Coming Back”)

Goal: remove dead feature surface area from both schema and application code.

- Database:
  - Drop `loyalty_*` tables and any related policies, functions, enums, and indexes.
  - Remove allow-all RLS policies currently attached to loyalty tables (covered by Phase 1).
- Application:
  - Remove stub modules and unused type surfaces to prevent accidental reintroduction.
  - Ensure migrations and generated types match reality.

Effort: M (1-2 days) depending on dependencies and migrations.
Risk: Medium (risk of accidentally removing still-used paths; mitigate via repo-wide search + tests).

### Phase 3: Query-Level Improvements (P1/P2)

Goal: improve latency on user-facing queries at scale.

- “Contains search” (`ilike '%term%'`) indexes:
  - Enable `pg_trgm` (if not already) and add targeted trigram indexes for:
    - bookings: `customer_name`, `customer_email`
    - customers: `full_name`, `email`, `phone`
- Reduce over-fetching in embedded selects (PostgREST):
  - audit `.select()` fields to avoid pulling JSON blobs when not needed.
- Validate PostgREST filters and order-by on foreign tables:
  - ensure indexes and query shapes are compatible with expected access patterns.

Effort: M (1-3 days).
Risk: Medium (index choice affects write performance).

### Phase 4: Maintenance + Retention + Partitioning (P2)

Goal: keep long-term storage and performance predictable.

- Retention policies for append-only tables:
  - `audit_logs`, `analytics_events`, `email_delivery_log`, `observability_events`
  - Implement via `pg_cron` with clear retention windows and auditability.
- Partitioning for large append-only tables:
  - monthly partitions by `created_at`
  - ensure partition pruning works for common queries (date range predicates).

Effort: L-XL (1-4+ weeks depending on table count and rollout rigor).
Risk: High (partitioning migrations are complex; require careful expansion/backfill/contraction plan).

## Cost/Benefit (Major Changes)

| Change                     | Benefit                                                     | Cost   | Risk                            |
| -------------------------- | ----------------------------------------------------------- | ------ | ------------------------------- |
| Fix allow-all RLS policies | Prevents data exposure; restores least privilege            | Low    | High (breaking access if wrong) |
| Add missing FK indexes     | Faster FK checks; fewer lock stalls; faster joins           | Low    | Low                             |
| Drop redundant indexes     | Lower write latency + bloat; smaller backups                | Medium | Medium                          |
| Trigram indexes for search | Improves p95 search latency by orders of magnitude at scale | Medium | Medium (extra write/storage)    |
| Retention/partitioning     | Predictable performance as logs/events grow                 | High   | High                            |

## Before/After Projections (Directional)

These are projections; validate with staging data + workload replay:

- **Index dedupe**: expect measurable reduction in write time on `bookings` / assignments / holds proportional to number of indexes removed (often 10-30% improvements in write-heavy paths for heavily indexed tables).
- **Missing FK indexes**: worst-case “delete/update referenced row” can move from O(N) scan to O(log N) index lookup, reducing lock timeouts and spikes under concurrent load.
- **Trigram search indexes**: user-facing search can go from full table scan (seconds) to index-assisted (tens of ms) when data grows.

## Risk Assessment

- Biggest risk is **security policy changes** (accidental broadening, accidental denial of legitimate ops flows).
- Second biggest risk is **dropping indexes** without production-like workload verification.
- Partitioning/retention is high risk without a staged migration and rollback plan.
- Loyalty removal risk is moderate: depends on whether any remaining code paths still rely on those tables.

## Verification

- Capture staging evidence in `verification.md` + `artifacts/`.
- For any future applied change: before/after comparison (p95 latency, query mean time, buffer reads, CPU).
