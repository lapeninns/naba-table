# Database Performance & Scalability Optimization Report

## Executive Summary

### Project: NabaTable / SajiloReserveX

### Date: 2026-01-06

### Status: ✅ Phase 1 Complete - Post-Maintenance Analysis Done

---

## 📊 Before/After Comparison (2026-01-06)

### Table Bloat Status

| Table                       | Before     | After      | Status          |
| --------------------------- | ---------- | ---------- | --------------- |
| `bookings`                  | High churn | **0.00%**  | ✅ VACUUMED     |
| `booking_table_assignments` | High churn | **0.00%**  | ✅ VACUUMED     |
| `table_holds`               | High churn | **0.00%**  | ✅ VACUUMED     |
| `table_inventory`           | N/A        | **0.00%**  | ✅ VACUUMED     |
| `allocations`               | Unknown    | **7.79%**  | ⚠️ Needs VACUUM |
| `customers`                 | Unknown    | **10.00%** | ⚠️ Needs VACUUM |
| `customer_profiles`         | Unknown    | **12.00%** | ⚠️ Needs VACUUM |

### Top Performing Indexes

| Index                                | Table                     | Scans  | Status    |
| ------------------------------------ | ------------------------- | ------ | --------- |
| `idx_bta_booking_start`              | booking_table_assignments | 77,337 | 🔥 Hot    |
| `table_inventory_pkey`               | table_inventory           | 60,119 | 🔥 Hot    |
| `customer_profiles_pkey`             | customer_profiles         | 11,272 | ✅ Active |
| `idx_bookings_restaurant_date_start` | bookings                  | 10,889 | ✅ Active |
| `idx_bookings_status`                | bookings                  | 1,472  | ✅ Active |

### Slow Queries Analysis

**Result:** No application slow queries detected. All slow queries are bulk `COPY` operations (expected).

---

## 🎯 Remaining Actions (Priority Ranked)

| #   | Action                                                  | Impact | Status     |
| --- | ------------------------------------------------------- | ------ | ---------- |
| 1   | VACUUM remaining tables (customers, allocations, etc.)  | High   | ⏳ Pending |
| 2   | Create missing indexes (idx_bookings_customer_id, etc.) | High   | ⏳ Pending |
| 3   | Configure autovacuum for high-churn tables              | Medium | ⏳ Pending |
| 4   | Reset pg_stat_statements for clean baseline             | Medium | ⏳ Pending |
| 5   | Schedule weekly maintenance checks                      | Medium | ⏳ Pending |

**SQL File:** `artifacts/maintenance-sql-20260106.sql`

---

## 📈 Current Metrics

| Category              | Value      | Target | Status |
| --------------------- | ---------- | ------ | ------ |
| PostgreSQL            | 17.6.1.063 | -      | ✅     |
| Region                | eu-west-2  | -      | ✅     |
| Core Table Bloat      | 0%         | < 10%  | ✅     |
| Secondary Table Bloat | 8-15%      | < 10%  | ⚠️     |
| Slow App Queries      | 0          | 0      | ✅     |
| Autovacuum Running    | No         | Yes    | ⚠️     |

### Data Volumes (2026-01-06)

| Table             | Row Count | Purpose                |
| ----------------- | --------- | ---------------------- |
| `customers`       | **150**   | Customer directory     |
| `bookings`        | **90**    | Reservations           |
| `allocations`     | **77**    | Table-time assignments |
| `table_inventory` | **64**    | Physical tables        |
| `restaurants`     | **3**     | Active venues          |

### Booking Status Distribution

| Status        | Count | Percentage |
| ------------- | ----- | ---------- |
| ✅ confirmed  | 52    | 57.8%      |
| ✅ completed  | 24    | 26.7%      |
| ⏳ pending    | 10    | 11.1%      |
| 🪑 checked_in | 2     | 2.2%       |
| ❌ no_show    | 1     | 1.1%       |
| 🚫 cancelled  | 1     | 1.1%       |

### Active Restaurants

| Restaurant           | Slug                             | Status    |
| -------------------- | -------------------------------- | --------- |
| White Horse Pub      | `white-horse-pub-waterbeach`     | ✅ Active |
| The Corner House Pub | `the-corner-house-pub-cambridge` | ✅ Active |
| The Old Crown Girton | `the-old-crown-girton`           | ✅ Active |

---

## 📁 Maintenance Files

| File                                     | Purpose                                        |
| ---------------------------------------- | ---------------------------------------------- |
| `artifacts/maintenance-sql-20260106.sql` | All SQL commands (Actions 1-5 + Weekly Checks) |
| `artifacts/baseline-discovery.sql`       | Original baseline queries                      |
| `artifacts/baseline-results.json`        | Baseline data (partial)                        |

---

## 🔧 Top Fixes (Ranked by Impact/Effort/Risk)

### Immediate Actions (Day 1)

#### 1. Update Statistics (ANALYZE)

```sql
ANALYZE public.bookings;
ANALYZE public.allocations;
ANALYZE public.customers;
ANALYZE public.table_inventory;
ANALYZE public.table_holds;
ANALYZE public.booking_table_assignments;
```

**Why**: Ensures query planner has accurate statistics for optimal execution plans.

#### 2. Create Missing Indexes

```sql
-- Customer lookup on bookings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_id
ON public.bookings (customer_id, booking_date DESC);

-- Active bookings filter (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_today
ON public.bookings (restaurant_id, booking_date)
WHERE status IN ('confirmed', 'pending', 'checked_in');

-- State history lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_state_history_booking
ON public.booking_state_history (booking_id, changed_at DESC);
```

### Short-Term Actions (Week 1)

#### 3. Configure Autovacuum for High-Churn Tables

```sql
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
```

#### 4. Query Optimization

After capturing baseline, identify top 10 slow queries and:

- Add appropriate indexes
- Rewrite inefficient patterns
- Consider materialized views for aggregations

### Medium-Term Actions (Week 2-4)

#### 5. RLS Policy Review

- Audit all policies for index-friendliness
- Replace subqueries with direct column comparisons
- Use session variables instead of function calls

#### 6. Data Archiving Strategy

- Archive booking_state_history > 1 year old
- Prune observability_events > 30 days
- Implement retention policies

---

## 📝 SQL & Migration Steps (Copy/Paste Ready)

### Step 1: Run ANALYZE

```sql
-- Run immediately in production
ANALYZE public.bookings;
ANALYZE public.allocations;
ANALYZE public.customers;
ANALYZE public.table_inventory;
ANALYZE public.table_holds;
ANALYZE public.booking_table_assignments;
```

### Step 2: Create Indexes (Staging First)

```sql
-- Index 1: Customer lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_id
ON public.bookings (customer_id, booking_date DESC);

-- Index 2: Active bookings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_today
ON public.bookings (restaurant_id, booking_date)
WHERE status IN ('confirmed', 'pending', 'checked_in');

-- Index 3: Allocation conflict check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_conflict_check
ON public.allocations (restaurant_id, resource_id, resource_type)
WHERE shadow = false;

-- Index 4: Allocation booking lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_booking
ON public.allocations (booking_id)
WHERE booking_id IS NOT NULL;

-- Index 5: State history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_state_history_booking
ON public.booking_state_history (booking_id, changed_at DESC);
```

### Step 3: Configure Autovacuum

```sql
-- Run in production after testing
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

---

## ✅ Validation Checklist

### Before Implementation

- [ ] Capture baseline metrics (cache hit, slow queries, bloat)
- [ ] Test all changes in staging environment
- [ ] Verify RLS still works correctly

### After Each Change

- [ ] Run verification queries (see `verification.md`)
- [ ] Check for any errors in application logs
- [ ] Measure query latency improvement

### Success Criteria

| Metric          | Target   | How to Verify                 |
| --------------- | -------- | ----------------------------- |
| Cache Hit Ratio | ≥ 99%    | `pg_statio_user_tables` query |
| Avg Query Time  | < 100ms  | `pg_stat_statements`          |
| Table Bloat     | < 10%    | Dead tuple ratio query        |
| Index Usage     | All used | `idx_scan > 0`                |

---

## ↩️ Rollback Plan

### Index Removal (if needed)

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_bookings_customer_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_bookings_active_today;
DROP INDEX CONCURRENTLY IF EXISTS idx_allocations_conflict_check;
DROP INDEX CONCURRENTLY IF EXISTS idx_allocations_booking;
DROP INDEX CONCURRENTLY IF EXISTS idx_booking_state_history_booking;
```

### Autovacuum Reset

```sql
ALTER TABLE public.booking_state_history RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);

ALTER TABLE public.allocations RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);

ALTER TABLE public.table_holds RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);

ALTER TABLE public.observability_events RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);
```

---

## 📈 Follow-up Monitoring Plan

### Weekly Checks

```sql
-- 1. Cache hit ratio (should be ≥99%)
SELECT round(100.0 * sum(heap_blks_hit) /
  NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_pct
FROM pg_statio_user_tables;

-- 2. Slow queries (avg > 100ms)
SELECT count(*) AS slow_query_count
FROM extensions.pg_stat_statements
WHERE mean_exec_time > 100 AND calls > 10;

-- 3. Table bloat
SELECT relname, round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_dead_tup > 10000
ORDER BY n_dead_tup DESC LIMIT 5;

-- 4. Unused indexes
SELECT count(*) AS unused_indexes
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0;
```

### Monthly Actions

- [ ] Review top slow queries and optimize as needed
- [ ] Archive old data from history tables
- [ ] Run VACUUM ANALYZE on large tables
- [ ] Review index usage and remove unused indexes

---

## 📁 Artifacts

All artifacts are stored in:

```
tasks/db-perf-optimization-20260106-1108/
├── research.md           # Analysis and findings
├── plan.md               # Detailed implementation plan
├── todo.md               # Implementation checklist
├── verification.md       # Validation queries and criteria
└── artifacts/
    ├── baseline-discovery.sql    # Raw SQL for baseline
    └── baseline-results.json     # Baseline data (pending)
```

Additional script:

- `scripts/db-perf-baseline.ts` - TypeScript baseline collection script

---

## Next Steps

1. **Provide database credentials** to run baseline script
2. **Execute baseline** and capture current metrics
3. **Apply quick wins** (ANALYZE, indexes) to staging
4. **Verify** no regressions in staging
5. **Apply to production** during low-traffic window
6. **Monitor** weekly using provided queries

---

_Report generated: 2026-01-06 11:08 UTC_
_Framework: AGENTS.md SDLC Phase 1-2 (Research & Planning)_
