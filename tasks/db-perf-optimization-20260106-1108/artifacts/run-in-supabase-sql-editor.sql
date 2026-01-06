-- =====================================================
-- DATABASE PERFORMANCE BASELINE - COPY TO SUPABASE SQL EDITOR
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: nabatable-staging (rrpeokmfbtbrirqjprpe)
-- Date: 2026-01-06
-- =====================================================

-- 1. DATABASE VERSION & EXTENSIONS
SELECT '=== DATABASE VERSION ===' AS section;
SELECT version() AS postgres_version;

SELECT '=== EXTENSIONS ===' AS section;
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- 2. TABLE SIZES (Largest First)
SELECT '=== TABLE SIZES ===' AS section;
SELECT 
  tablename,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || quote_ident(tablename))) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) DESC
LIMIT 25;

-- 3. CACHE HIT RATIO (Target: ≥99%)
SELECT '=== CACHE HIT RATIO ===' AS section;
SELECT 
  round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_ratio_percent,
  CASE 
    WHEN round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 99 
    THEN '✅ GOOD'
    ELSE '⚠️ NEEDS ATTENTION'
  END AS status
FROM pg_statio_user_tables;

-- 4. TOP SLOW QUERIES (by total time)
SELECT '=== TOP 20 SLOW QUERIES (by total time) ===' AS section;
SELECT 
  left(query, 150) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  rows
FROM extensions.pg_stat_statements
WHERE query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
  AND query NOT LIKE 'SET %'
ORDER BY total_exec_time DESC
LIMIT 20;

-- 5. TOP QUERIES BY AVERAGE TIME (min 10 calls)
SELECT '=== TOP QUERIES BY AVG TIME ===' AS section;
SELECT 
  left(query, 150) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  CASE WHEN mean_exec_time > 100 THEN '⚠️ SLOW' ELSE '✅' END AS status
FROM extensions.pg_stat_statements
WHERE calls >= 10
  AND query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 6. SEQUENTIAL SCAN ANALYSIS (Candidates for Indexing)
SELECT '=== SEQUENTIAL SCAN ANALYSIS ===' AS section;
SELECT 
  relname AS tablename,
  seq_scan,
  idx_scan,
  n_live_tup AS rows,
  round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS seq_scan_pct,
  CASE 
    WHEN seq_scan > idx_scan AND n_live_tup > 1000 THEN '⚠️ ADD INDEX'
    ELSE '✅'
  END AS recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan > 0 OR idx_scan > 0)
ORDER BY seq_scan DESC
LIMIT 20;

-- 7. TABLE BLOAT CHECK
SELECT '=== TABLE BLOAT ===' AS section;
SELECT 
  relname AS tablename,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
  last_autovacuum,
  CASE 
    WHEN n_dead_tup > 10000 OR (n_dead_tup::float / NULLIF(n_live_tup, 1)) > 0.1 
    THEN '⚠️ VACUUM NEEDED'
    ELSE '✅'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 15;

-- 8. INDEX USAGE
SELECT '=== INDEX USAGE (Top 30 by scans) ===' AS section;
SELECT 
  sui.relname AS tablename,
  sui.indexrelname AS indexname,
  sui.idx_scan AS scans,
  pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size
FROM pg_stat_user_indexes sui
WHERE sui.schemaname = 'public'
ORDER BY sui.idx_scan DESC
LIMIT 30;

-- 9. UNUSED INDEXES (Candidates for Removal)
SELECT '=== UNUSED INDEXES ===' AS section;
SELECT 
  sui.relname AS tablename,
  sui.indexrelname AS indexname,
  pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size,
  '⚠️ UNUSED - verify before dropping' AS status
FROM pg_stat_user_indexes sui
JOIN pg_indexes pi 
  ON sui.indexrelname = pi.indexname 
  AND sui.schemaname = pi.schemaname
WHERE sui.schemaname = 'public'
  AND sui.idx_scan = 0
  AND pi.indexdef NOT LIKE '%UNIQUE%'
  AND pi.indexdef NOT LIKE '%PRIMARY%'
ORDER BY pg_relation_size(sui.indexrelid) DESC;

-- 10. RLS POLICIES
SELECT '=== RLS POLICIES PER TABLE ===' AS section;
SELECT 
  tablename,
  count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;

-- 11. CONNECTION STATS
SELECT '=== CONNECTION STATS ===' AS section;
SELECT 
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx
FROM pg_stat_activity
WHERE backend_type = 'client backend';

-- 12. DATABASE SUMMARY
SELECT '=== DATABASE SUMMARY ===' AS section;
SELECT 
  pg_database.datname AS database,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
  numbackends AS connections,
  round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS cache_hit_pct,
  deadlocks
FROM pg_stat_database
JOIN pg_database ON pg_database.datname = pg_stat_database.datname
WHERE pg_database.datname = current_database();

-- 13. AUTOVACUUM SETTINGS
SELECT '=== AUTOVACUUM SETTINGS ===' AS section;
SELECT name, setting, unit
FROM pg_settings
WHERE name LIKE '%autovacuum%'
ORDER BY name;

SELECT '=== BASELINE COMPLETE ===' AS section;
