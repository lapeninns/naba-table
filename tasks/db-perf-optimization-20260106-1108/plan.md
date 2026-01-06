---
task: db-perf-optimization
timestamp_utc: 2026-01-06T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Database Performance & Scalability Optimization

## Objective

We will **optimize database performance** for the NabaTable booking platform to **reduce query latency, improve cache hit ratio, and establish sustainable maintenance practices** so that the application remains responsive as data volume grows.

## Success Criteria

- [ ] Cache hit ratio ≥ 99%
- [ ] Top 10 queries avg latency < 100ms
- [ ] No unused indexes remaining (or documented exceptions)
- [ ] RLS policies verified for index-friendliness
- [ ] Autovacuum configured for high-churn tables
- [ ] Monitoring queries documented and runnable

---

## Discovery Phase (Run First)

### Step 1: Execute Baseline Script

```bash
# Set your database URL
export SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.rrpeokmfbtbrirqjprpe.supabase.co:5432/postgres"

# Run baseline discovery
npx tsx scripts/db-perf-baseline.ts
```

This generates `tasks/db-perf-optimization-20260106-1108/artifacts/baseline-results.json`

### Step 2: Manual Queries (if script doesn't work)

Connect via `psql` or Supabase SQL Editor and run:

```sql
-- Database version
SELECT version();

-- Table sizes (largest first)
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || quote_ident(tablename))) AS total_size,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || quote_ident(tablename)) DESC
LIMIT 20;

-- Cache hit ratio (should be ≥99%)
SELECT
  round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2)
  AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Top slow queries (by total time)
SELECT
  left(query, 200) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS avg_time_ms
FROM extensions.pg_stat_statements
WHERE query NOT LIKE 'COMMIT%' AND query NOT LIKE 'BEGIN%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Sequential scan heavy tables (candidates for indexing)
SELECT
  relname AS tablename,
  seq_scan,
  idx_scan,
  round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS seq_scan_pct,
  n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > idx_scan
  AND n_live_tup > 1000
ORDER BY seq_scan DESC;

-- Unused indexes (candidates for removal)
SELECT
  indexname,
  tablename,
  pg_size_pretty(pg_relation_size('public.' || quote_ident(indexname))) AS size
FROM pg_stat_user_indexes sui
JOIN pg_indexes pi ON sui.indexrelname = pi.indexname
WHERE sui.schemaname = 'public'
  AND idx_scan = 0
  AND pi.indexdef NOT LIKE '%UNIQUE%'
  AND pi.indexdef NOT LIKE '%PRIMARY%'
ORDER BY pg_relation_size('public.' || quote_ident(indexname)) DESC;
```

---

## Index Strategy & Recommendations

### A. Recommended New Indexes

Based on schema analysis and common query patterns:

#### 1. Bookings Table - High Priority

```sql
-- Composite index for dashboard queries (restaurant + date + status)
-- Already exists: bookings_restaurant_date_status_idx
-- Verify effectiveness with EXPLAIN ANALYZE

-- Index for customer lookup (common lookup pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_id
ON public.bookings (customer_id, booking_date DESC);

-- Partial index for active bookings (frequently queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_today
ON public.bookings (restaurant_id, booking_date)
WHERE status IN ('confirmed', 'pending', 'checked_in');
```

#### 2. Allocations Table - Critical for Conflict Detection

```sql
-- Composite index for conflict queries
-- The window GiST index exists, but we need a composite for restaurant+resource+window
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_conflict_check
ON public.allocations (restaurant_id, resource_id, resource_type)
WHERE shadow = false;

-- Index for booking lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_booking
ON public.allocations (booking_id)
WHERE booking_id IS NOT NULL;
```

#### 3. Table Holds - Cleanup & Lookup

```sql
-- Already well-indexed, verify expires_at is indexed for sweeper jobs
-- Exists: table_holds_expires_at_idx

-- Partial index for expired holds cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_holds_expired
ON public.table_holds (expires_at)
WHERE expires_at < NOW() + INTERVAL '1 day';
```

#### 4. Customers Table

```sql
-- Index for email lookup (case-insensitive search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_lower
ON public.customers (restaurant_id, lower(email));

-- Already have: idx_customers_email_normalized (good if normalized on write)
```

#### 5. Booking State History - Reporting

```sql
-- Index for booking history lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_state_history_booking
ON public.booking_state_history (booking_id, changed_at DESC);
```

### B. Potential Index Removals (Verify First)

Use this query to identify unused indexes, then **verify they're truly unused** before dropping:

```sql
-- Find unused indexes with their definitions
SELECT
  sui.indexrelname AS indexname,
  sui.relname AS tablename,
  pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size,
  pi.indexdef
FROM pg_stat_user_indexes sui
JOIN pg_indexes pi
  ON sui.indexrelname = pi.indexname
  AND sui.schemaname = pi.schemaname
WHERE sui.schemaname = 'public'
  AND sui.idx_scan = 0
  AND pi.indexdef NOT LIKE '%UNIQUE%'
  AND pi.indexdef NOT LIKE '%PRIMARY%'
  AND sui.indexrelid NOT IN (
    SELECT conindid FROM pg_constraint WHERE contype IN ('p', 'u')
  )
ORDER BY pg_relation_size(sui.indexrelid) DESC;
```

**WARNING**: Do NOT drop indexes without:

1. Verifying pg_stat_statements stats have been running long enough
2. Testing in staging environment first
3. Having rollback plan (CREATE INDEX script saved)

### C. JSONB Indexing Opportunities

If queries filter by JSONB fields:

```sql
-- If you query bookings.details->>'someField' frequently:
-- CREATE INDEX CONCURRENTLY idx_bookings_details_gin
-- ON public.bookings USING gin (details jsonb_path_ops);

-- For specific key access:
-- CREATE INDEX CONCURRENTLY idx_bookings_details_key
-- ON public.bookings ((details->>'someKey'));
```

---

## Query Optimization Recommendations

### Pattern 1: Dashboard Summary Queries

**Problem**: Dashboard likely aggregates bookings by date/status.

**Recommendation**: Ensure covering indexes or consider materialized view:

```sql
-- Materialized view for daily summary (refresh every 5 min)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_booking_summary AS
SELECT
  restaurant_id,
  booking_date,
  status,
  COUNT(*) as count,
  SUM(party_size) as total_covers
FROM public.bookings
WHERE booking_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY restaurant_id, booking_date, status;

CREATE UNIQUE INDEX ON mv_daily_booking_summary (restaurant_id, booking_date, status);

-- Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_booking_summary;
```

### Pattern 2: Table Availability Checks

**Problem**: Checking table availability requires scanning allocations with time range overlaps.

**Current Solution**: GiST index on `window` column ✅

**Optimization**: Ensure exclusion constraint is in place:

```sql
-- Verify exclusion constraint exists (should already be there)
-- This prevents overlapping allocations on same resource
ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    resource_type WITH =,
    "window" WITH &&
  ) WHERE (shadow = false AND booking_id IS NOT NULL);
```

### Pattern 3: Customer Lookup

**Problem**: Looking up customers by email/phone.

**Optimization**: Ensure normalized columns are indexed:

```sql
-- Already exists: idx_customers_email_normalized
-- Already exists: idx_customers_phone_normalized
-- Verify with: \d customers
```

---

## RLS Performance Review

### Common RLS Anti-Patterns to Check

1. **Function calls in policy**: Avoid `SELECT` subqueries or volatile functions
2. **Non-sargable predicates**: Ensure WHERE clauses can use indexes
3. **Cross-table lookups**: Minimize joins in policy expressions

### Optimization Pattern

**Bad (non-sargable)**:

```sql
-- Policy that can't use indexes
CREATE POLICY view_own ON bookings
  USING (customer_email = (SELECT email FROM customers WHERE id = auth.uid()));
```

**Good (sargable)**:

```sql
-- Policy that uses indexed column directly
CREATE POLICY view_own ON bookings
  USING (restaurant_id = current_setting('app.restaurant_id')::uuid);
```

### Review Existing Policies

```sql
-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual::text AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

For each policy with subqueries or function calls, consider:

1. Caching the result in a JWT claim or session variable
2. Using `SECURITY DEFINER` helper functions (carefully)
3. Restructuring to use direct column comparisons

---

## Maintenance & Vacuum Configuration

### High-Churn Table Configuration

```sql
-- Configure aggressive autovacuum for high-write tables
-- Run these in PRODUCTION with appropriate values

-- booking_state_history (append-only, many inserts)
ALTER TABLE public.booking_state_history SET (
  autovacuum_vacuum_scale_factor = 0.02,  -- vacuum at 2% dead tuples
  autovacuum_analyze_scale_factor = 0.01  -- analyze at 1% change
);

-- allocations (frequent inserts/updates)
ALTER TABLE public.allocations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- table_holds (frequent creation/expiration)
ALTER TABLE public.table_holds SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- observability_events (high-volume logging)
ALTER TABLE public.observability_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
```

### Manual VACUUM/ANALYZE

```sql
-- Run ANALYZE on tables after significant data changes
ANALYZE public.bookings;
ANALYZE public.allocations;
ANALYZE public.customers;
ANALYZE public.table_inventory;

-- Check table bloat before vacuuming
SELECT
  relname,
  n_dead_tup,
  n_live_tup,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 10;
```

---

## Connection & Pooling Recommendations

### Supabase Connection Settings

1. **Use connection pooler** for serverless functions
   - Direct connection for long-running scripts
   - Pooler (port 6543) for API/edge functions

2. **Transaction patterns**
   - Keep transactions short
   - Avoid `SELECT FOR UPDATE` across multiple round-trips
   - Use stored procedures for complex atomic operations

### Configuration Checks

```sql
-- Current connection info
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx
FROM pg_stat_activity
WHERE backend_type = 'client backend';

-- Long-running transactions (potential blockers)
SELECT
  pid,
  age(clock_timestamp(), xact_start) AS xact_age,
  state,
  left(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 10;
```

---

## Data Archiving Strategy

### Candidates for Archiving

| Table                   | Retention | Archive Strategy         |
| ----------------------- | --------- | ------------------------ |
| `booking_state_history` | 1 year    | Move to `_archive` table |
| `booking_versions`      | 6 months  | Move to `_archive` table |
| `observability_events`  | 30 days   | Delete (append-only log) |
| `audit_logs`            | 1 year    | Move to cold storage     |

### Archive Pattern

```sql
-- Create archive table (one-time)
CREATE TABLE IF NOT EXISTS public.booking_state_history_archive
  (LIKE public.booking_state_history INCLUDING ALL);

-- Move old records (run monthly)
WITH moved AS (
  DELETE FROM public.booking_state_history
  WHERE changed_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
  RETURNING *
)
INSERT INTO public.booking_state_history_archive
SELECT * FROM moved;

-- Track archival
COMMENT ON TABLE public.booking_state_history_archive IS
  'Archived booking state history records older than 1 year';
```

---

## Monitoring Queries (Run Weekly)

### 1. Cache Hit Ratio Check

```sql
SELECT
  round(100.0 * sum(heap_blks_hit) /
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_pct,
  CASE
    WHEN round(100.0 * sum(heap_blks_hit) /
      NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 99
    THEN '✅ Good'
    ELSE '⚠️ Needs attention'
  END AS status
FROM pg_statio_user_tables;
```

### 2. Slow Query Summary

```sql
SELECT
  count(*) AS slow_queries,
  round(avg(mean_exec_time)::numeric, 2) AS avg_ms
FROM extensions.pg_stat_statements
WHERE mean_exec_time > 100
  AND calls > 10;
```

### 3. Table Bloat Check

```sql
SELECT
  relname,
  n_dead_tup,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
  CASE WHEN n_dead_tup > 10000 THEN '⚠️ Consider VACUUM' ELSE '✅' END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### 4. Index Usage Efficiency

```sql
SELECT
  count(*) AS unused_indexes,
  pg_size_pretty(sum(pg_relation_size(indexrelid))) AS wasted_space
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelid NOT IN (
    SELECT conindid FROM pg_constraint WHERE contype IN ('p', 'u')
  );
```

---

## Rollback Plan

### Index Changes

All index recommendations use `CREATE INDEX CONCURRENTLY`, which can be rolled back with:

```sql
DROP INDEX CONCURRENTLY IF EXISTS index_name;
```

### Configuration Changes

Autovacuum settings can be reset with:

```sql
ALTER TABLE tablename RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);
```

### Materialized Views

```sql
DROP MATERIALIZED VIEW IF EXISTS mv_daily_booking_summary;
```

---

## Implementation Phases

### Phase 1: Discovery (Day 1)

- [ ] Run baseline script
- [ ] Capture current metrics
- [ ] Identify top 10 slow queries

### Phase 2: Quick Wins (Day 2-3)

- [ ] Create recommended indexes
- [ ] Run ANALYZE on core tables
- [ ] Configure autovacuum for high-churn tables

### Phase 3: Query Optimization (Day 4-5)

- [ ] Optimize identified slow queries
- [ ] Review RLS policies
- [ ] Test in staging

### Phase 4: Monitoring Setup (Day 6)

- [ ] Create monitoring dashboard/queries
- [ ] Document maintenance runbook
- [ ] Verify all changes in production

---

## Verification Checklist

- [ ] Before/after EXPLAIN ANALYZE for optimized queries
- [ ] Cache hit ratio measured and documented
- [ ] Index usage stats show new indexes being used
- [ ] No regression in application response times
- [ ] RLS security verified (no unauthorized access)
- [ ] Autovacuum running as expected
