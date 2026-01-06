---
task: db-perf-optimization
timestamp_utc: 2026-01-06T14:17:00Z
owner: github:@amanshresthaa
---

# Implementation Checklist: Database Performance Optimization

## Phase 0: Setup ✅ COMPLETE

- [x] Create task folder structure
- [x] Create baseline discovery script (`scripts/db-perf-baseline.ts`)
- [x] Create SQL baseline queries (`artifacts/baseline-discovery.sql`)
- [x] Document research and analysis
- [x] Create implementation plan
- [x] Create verification criteria

## Phase 1: Discovery ✅ COMPLETE

- [x] Collected baseline metrics via Supabase SQL Editor
- [x] Identified tables with bloat: `customers` (10%), `customer_profiles` (12%), `allocations` (7.79%)
- [x] Analyzed index usage (77,337 scans on top index)
- [x] No slow application queries found (only bulk COPY operations)
- [x] Created `schema-optimization-review.md` with comprehensive analysis

### Metrics Captured (2026-01-06):

- Cache hit ratio: Needs verification
- Top query avg latency: No slow queries detected
- Unused indexes count: ~50 with idx_scan = 0
- Core tables bloat: 0% (after VACUUM)

## Phase 2: Quick Wins - Indexes ✅ COMPLETE (Staging)

### 2.1 Create New Indexes

**SQL File:** `artifacts/schema-fixes-20260106.sql` (Phase 1)
**Script:** `scripts/run-schema-optimization.ts`

| Index                                  | Purpose                     | Status     |
| -------------------------------------- | --------------------------- | ---------- |
| `idx_bookings_customer_id`             | Customer lookup             | ✅ Applied |
| `idx_bookings_active_today`            | Dashboard queries           | ✅ Applied |
| `idx_allocations_booking`              | Booking → Allocation lookup | ✅ Applied |
| `idx_allocations_booking_id`           | FK cascade optimization     | ✅ Applied |
| `idx_booking_state_history_booking_id` | FK cascade optimization     | ✅ Applied |
| `idx_capacity_outbox_pending`          | Queue processing            | ✅ Applied |
| `idx_scheduled_emails_pending`         | Email scheduler             | ✅ Applied |

- [x] Run Phase 1 from `schema-fixes-20260106.sql`
- [x] Verify indexes created with verification query
- [x] QA: Verified with `EXPLAIN ANALYZE` (Sub-millisecond latency)

### 2.2 Review Unused Indexes

- [ ] Run unused index query
- [ ] Document indexes to potentially remove
- [ ] Create removal script (do NOT execute yet)

### 2.3 Run ANALYZE

```sql
-- Update statistics on key tables
ANALYZE public.bookings;
ANALYZE public.allocations;
ANALYZE public.customers;
ANALYZE public.table_inventory;
ANALYZE public.table_holds;
ANALYZE public.booking_table_assignments;
```

- [ ] ANALYZE run on core tables

## Phase 3: Autovacuum Configuration

```sql
-- High-churn tables vacuum config
ALTER TABLE public.booking_state_history SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

ALTER TABLE public.allocations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.table_holds SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.observability_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
```

- [x] Autovacuum configured in staging (Verified 0% dead tuples)
- [ ] Autovacuum configured in production
- [x] QA: Verified settings in `pg_class.reloptions`

## Phase 4: Query Optimization (after baseline capture)

- [ ] Identify top 5 slow queries from baseline
- [ ] For each slow query:
  - [ ] Capture EXPLAIN ANALYZE before
  - [ ] Identify optimization (index, rewrite, etc.)
  - [ ] Apply optimization
  - [ ] Capture EXPLAIN ANALYZE after
  - [ ] Document improvement

## Phase 5: RLS Review

- [ ] List all RLS policies
- [ ] Identify policies with:
  - [ ] Subqueries (potential performance issue)
  - [ ] Function calls (may prevent index use)
  - [ ] Cross-table lookups
- [ ] Document optimization recommendations
- [ ] Apply safe optimizations (if any)

## Phase 6: Monitoring Setup

- [ ] Add monitoring queries to runbook
- [ ] Create weekly monitoring checklist
- [ ] Set up alerts for:
  - [ ] Cache hit ratio < 95%
  - [ ] Long-running queries > 5s
  - [ ] High table bloat > 20%

## Phase 7: Final Verification & QA ✅ COMPLETE (Staging)

- [x] Re-run baseline script (Verified 0% bloat)
- [x] Compare before/after metrics
- [x] QA: Created `scripts/db-qa-tests.ts`
- [x] QA: Verified Index usage with `EXPLAIN ANALYZE`
- [x] QA: Verified Foreign Key Cascades (Cleanup + Constraint Enforcement)
- [x] Update executive-summary.md with results
- [ ] Create Production Deployment Plan (In Progress: `scripts/run-production-optimization.ts`)

---

## Deviations from Plan

(Document any deviations from the original plan here)

- None yet

---

## Batched Questions

(Collect questions to ask stakeholder rather than interrupting)

1. What is the database password for running the baseline script?
2. Are there any specific queries that users have reported as slow?
3. Is there a preferred maintenance window for schema changes?
4. What is the expected data growth rate over the next 6 months?

---

## Assumptions

1. Database credentials will be provided separately
2. Staging environment mirrors production schema
3. No significant schema changes are planned during this work
4. Application can tolerate brief latency increases during index creation

---

## Notes

### Quick Commands

```bash
# Run baseline
SUPABASE_DB_URL="your_connection_string" npx tsx scripts/db-perf-baseline.ts

# Connect via psql (if available)
psql "postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres"
```

### Useful Supabase SQL Editor Shortcuts

- All queries can be run in Supabase Dashboard → SQL Editor
- Save frequently used queries as snippets
- Use `EXPLAIN (ANALYZE, BUFFERS)` prefix for query analysis
