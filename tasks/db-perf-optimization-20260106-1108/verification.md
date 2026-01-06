---
task: db-perf-optimization
timestamp_utc: 2026-01-06T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
---

# Verification Report: Database Performance Optimization

## Pre-Implementation Baseline

**Status**: Awaiting baseline execution

| Metric                     | Before | After | Target                 | Status |
| -------------------------- | ------ | ----- | ---------------------- | ------ |
| Cache Hit Ratio            | TBD    | -     | ≥ 99%                  | ⏳     |
| Avg Query Latency (top 10) | TBD    | -     | < 100ms                | ⏳     |
| Unused Indexes             | TBD    | -     | 0 or documented        | ⏳     |
| Table Bloat (max dead %)   | TBD    | -     | < 10%                  | ⏳     |
| Sequential Scan Ratio      | TBD    | -     | < 20% for large tables | ⏳     |

---

## Validation Queries

### 1. Cache Hit Ratio

```sql
SELECT
  round(100.0 * sum(heap_blks_hit) /
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_ratio,
  CASE
    WHEN round(100.0 * sum(heap_blks_hit) /
      NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 99
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS status
FROM pg_statio_user_tables;
```

**Expected**: ≥ 99%

---

### 2. Top Query Performance

```sql
SELECT
  left(query, 150) AS query,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  CASE
    WHEN mean_exec_time < 100 THEN '✅ PASS'
    ELSE '⚠️ NEEDS WORK'
  END AS status
FROM extensions.pg_stat_statements
WHERE calls >= 10
  AND query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

**Expected**: All queries < 100ms avg

---

### 3. Index Usage Verification

```sql
-- Verify new indexes are being used
SELECT
  indexrelname AS index_name,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  CASE
    WHEN idx_scan > 0 THEN '✅ IN USE'
    ELSE '⚠️ NOT USED YET'
  END AS status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_bookings%'
   OR indexrelname LIKE 'idx_allocations%'
ORDER BY idx_scan DESC;
```

---

### 4. Table Bloat Check

```sql
SELECT
  relname AS table_name,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
  CASE
    WHEN n_dead_tup = 0 OR (n_dead_tup::float / NULLIF(n_live_tup, 1)) < 0.1
    THEN '✅ PASS'
    ELSE '⚠️ HIGH BLOAT'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 1000
ORDER BY dead_pct DESC
LIMIT 15;
```

**Expected**: < 10% dead tuple ratio

---

### 5. Sequential Scan Analysis

```sql
SELECT
  relname AS table_name,
  seq_scan,
  idx_scan,
  round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS seq_scan_pct,
  n_live_tup AS rows,
  CASE
    WHEN seq_scan < idx_scan OR n_live_tup < 1000 THEN '✅ PASS'
    ELSE '⚠️ HIGH SEQ SCAN'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan_pct DESC
LIMIT 15;
```

**Expected**: < 50% seq scans for tables > 1000 rows

---

### 6. RLS Performance Check

```sql
-- Count policies that might have performance issues
SELECT
  tablename,
  policyname,
  CASE
    WHEN qual::text LIKE '%SELECT%' THEN '⚠️ SUBQUERY'
    WHEN qual::text LIKE '%()%' THEN '⚠️ FUNCTION CALL'
    ELSE '✅ DIRECT'
  END AS policy_type,
  left(qual::text, 100) AS expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY
  CASE WHEN qual::text LIKE '%SELECT%' THEN 1
       WHEN qual::text LIKE '%()%' THEN 2
       ELSE 3
  END;
```

---

### 7. Autovacuum Status

```sql
SELECT
  relname AS table_name,
  last_autovacuum,
  last_autoanalyze,
  autovacuum_count,
  autoanalyze_count,
  CASE
    WHEN last_autovacuum IS NULL AND n_dead_tup > 1000
    THEN '⚠️ NEVER VACUUMED'
    ELSE '✅ OK'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (relname LIKE 'booking%'
       OR relname LIKE 'allocation%'
       OR relname LIKE 'table_hold%')
ORDER BY autovacuum_count DESC;
```

---

### 8. Connection Health

```sql
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  CASE
    WHEN count(*) FILTER (WHERE state = 'idle in transaction') > 5
    THEN '⚠️ IDLE TX ISSUES'
    ELSE '✅ OK'
  END AS status
FROM pg_stat_activity
WHERE backend_type = 'client backend';
```

---

## Success Criteria Checklist

### Performance Metrics

- [ ] Cache hit ratio ≥ 99%
- [ ] No query with avg time > 100ms (for frequent queries)
- [ ] Table bloat < 10% across all tables
- [ ] Indexes being used (idx_scan > 0 after sufficient traffic)

### Security Verification

- [ ] RLS policies unchanged (or improved, not weakened)
- [ ] No unauthorized data access possible
- [ ] All changes tested in staging first

### Maintenance Configuration

- [ ] Autovacuum configured for high-churn tables
- [ ] Monitoring queries documented
- [ ] Rollback scripts available

### Documentation

- [ ] All changes documented in task folder
- [ ] Performance delta captured before/after
- [ ] Known issues documented with owners

---

## Sign-off

- [ ] Engineering Review: **********\_\_**********
- [ ] DBA Review (if available): **********\_\_**********
- [ ] QA Verification: **********\_\_**********

---

## Notes

### Pending Items

1. Baseline metrics need to be captured with valid database credentials
2. After implementing changes, re-run all verification queries
3. Compare before/after metrics and document improvements

### Artifacts

- `artifacts/baseline-results.json` - Full baseline metrics (pending)
- `artifacts/baseline-discovery.sql` - Raw SQL queries for baseline
