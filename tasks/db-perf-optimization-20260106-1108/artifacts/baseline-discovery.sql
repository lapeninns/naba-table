-- =============================================================
-- DATABASE PERFORMANCE BASELINE DISCOVERY SCRIPT
-- SajiloReserveX / NabaTable Platform
-- Generated: 2026-01-06 11:08 UTC
-- =============================================================

-- SECTION 0: Database Version and Extensions
-- =============================================================
\echo '=== SECTION 0: DATABASE VERSION & EXTENSIONS ==='

SELECT version() AS postgres_version;

SELECT 
  extname AS extension_name, 
  extversion AS version,
  n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY extname;

-- SECTION 1: Schema Overview - Tables, Row Counts, Size
-- =============================================================
\echo '=== SECTION 1: SCHEMA OVERVIEW - TABLES ==='

-- All tables with row counts and sizes (approximate but fast)
SELECT 
  schemaname,
  tablename,
  n_live_tup AS estimated_row_count,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || quote_ident(tablename))) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(tablename))) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || quote_ident(tablename))) AS indexes_size,
  ROUND(100.0 * pg_indexes_size(schemaname || '.' || quote_ident(tablename)) / 
        NULLIF(pg_total_relation_size(schemaname || '.' || quote_ident(tablename)), 0), 1) AS index_ratio_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) DESC;

-- Table analysis age
SELECT 
  schemaname,
  relname AS tablename,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- SECTION 2: Existing Indexes
-- =============================================================
\echo '=== SECTION 2: EXISTING INDEXES ==='

-- All indexes with type, columns, and usage stats
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(indexname))) AS index_size
FROM pg_stat_user_indexes sui
JOIN pg_indexes pi 
  ON sui.indexrelname = pi.indexname 
  AND sui.schemaname = pi.schemaname
WHERE sui.schemaname = 'public'
ORDER BY idx_scan DESC;

-- Unused indexes (0 scans)
\echo '=== UNUSED INDEXES (0 scans since stats reset) ==='
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(indexname))) AS index_size
FROM pg_stat_user_indexes sui
JOIN pg_indexes pi 
  ON sui.indexrelname = pi.indexname 
  AND sui.schemaname = pi.schemaname
WHERE sui.schemaname = 'public'
  AND idx_scan = 0
  AND NOT indexdef LIKE '%UNIQUE%'
  AND NOT indexdef LIKE '%PRIMARY%'
ORDER BY pg_relation_size(schemaname || '.' || quote_ident(indexname)) DESC;

-- SECTION 3: Missing Foreign Key Indexes
-- =============================================================
\echo '=== SECTION 3: MISSING FOREIGN KEY INDEXES ==='

-- Check for foreign keys without supporting indexes
SELECT
  c.conrelid::regclass AS table_name,
  c.conname AS constraint_name,
  a.attname AS column_name,
  c.confrelid::regclass AS referenced_table
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND c.conrelid::regclass::text NOT LIKE 'pg_%'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  )
ORDER BY c.conrelid::regclass::text;

-- SECTION 4: Table Bloat Estimation
-- =============================================================
\echo '=== SECTION 4: TABLE BLOAT ESTIMATION ==='

-- Estimated table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(tablename))) AS table_size,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  CASE WHEN n_live_tup > 0 
    THEN round(100.0 * n_dead_tup / n_live_tup, 2) 
    ELSE 0 
  END AS dead_to_live_pct,
  last_autovacuum,
  autovacuum_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 20;

-- SECTION 5: Index Bloat Estimation
-- =============================================================
\echo '=== SECTION 5: INDEX BLOAT ESTIMATION ==='

-- Index efficiency (scans vs fetches ratio)
SELECT
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  idx_scan AS index_scans,
  idx_tup_read,
  idx_tup_fetch,
  CASE WHEN idx_scan > 0 
    THEN round((idx_tup_fetch::numeric / idx_scan), 2)
    ELSE 0 
  END AS avg_tuples_per_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan > 0
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 30;

-- SECTION 6: Top Slow Queries (pg_stat_statements)
-- =============================================================
\echo '=== SECTION 6: TOP SLOW QUERIES ==='

-- Top 20 by total time
SELECT 
  left(query, 200) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS avg_time_ms,
  round(min_exec_time::numeric, 2) AS min_time_ms,
  round(max_exec_time::numeric, 2) AS max_time_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  rows,
  round(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_pct
FROM extensions.pg_stat_statements
WHERE query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
  AND query NOT LIKE 'SET %'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Top 20 by average time (for queries called at least 10 times)
\echo '=== TOP QUERIES BY AVERAGE TIME (min 10 calls) ==='
SELECT 
  left(query, 200) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_time_ms,
  round(max_exec_time::numeric, 2) AS max_time_ms,
  rows,
  round(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_pct
FROM extensions.pg_stat_statements
WHERE calls >= 10
  AND query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Top 20 by call frequency
\echo '=== TOP QUERIES BY FREQUENCY ==='
SELECT 
  left(query, 200) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS avg_time_ms,
  rows
FROM extensions.pg_stat_statements
WHERE query NOT LIKE 'COMMIT%'
  AND query NOT LIKE 'BEGIN%'
ORDER BY calls DESC
LIMIT 20;

-- SECTION 7: Sequential Scan Heavy Tables
-- =============================================================
\echo '=== SECTION 7: SEQUENTIAL SCAN ANALYSIS ==='

SELECT 
  schemaname,
  relname AS tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_live_tup AS estimated_rows,
  CASE 
    WHEN seq_scan + COALESCE(idx_scan, 0) > 0 
    THEN round(100.0 * seq_scan / (seq_scan + COALESCE(idx_scan, 0)), 2)
    ELSE 0 
  END AS seq_scan_pct,
  pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(relname))) AS table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan > 0 OR idx_scan > 0)
ORDER BY seq_scan DESC
LIMIT 20;

-- SECTION 8: Connection Stats
-- =============================================================
\echo '=== SECTION 8: CONNECTION STATS ==='

SELECT 
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
  count(*) FILTER (WHERE state = 'idle in transaction (aborted)') AS aborted,
  max(EXTRACT(EPOCH FROM (now() - backend_start))) AS oldest_connection_seconds
FROM pg_stat_activity
WHERE backend_type = 'client backend';

-- Long running queries
\echo '=== LONG RUNNING QUERIES ==='
SELECT 
  pid,
  usename,
  application_name,
  state,
  EXTRACT(EPOCH FROM (now() - query_start)) AS query_duration_seconds,
  left(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start IS NOT NULL
ORDER BY query_start
LIMIT 10;

-- SECTION 9: Lock Contention
-- =============================================================
\echo '=== SECTION 9: LOCK CONTENTION ==='

SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- SECTION 10: Cache Hit Ratio
-- =============================================================
\echo '=== SECTION 10: CACHE HIT RATIO ==='

-- Overall cache hit ratio (should be > 99% for production)
SELECT 
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Per-table cache hit ratio
SELECT 
  schemaname,
  relname AS tablename,
  heap_blks_read,
  heap_blks_hit,
  round(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND (heap_blks_read + heap_blks_hit) > 100
ORDER BY heap_blks_read DESC
LIMIT 20;

-- Index cache hit ratio
SELECT 
  schemaname,
  relname AS tablename,
  indexrelname,
  idx_blks_read,
  idx_blks_hit,
  round(100.0 * idx_blks_hit / NULLIF(idx_blks_hit + idx_blks_read, 0), 2) AS hit_ratio
FROM pg_statio_user_indexes
WHERE schemaname = 'public'
  AND (idx_blks_read + idx_blks_hit) > 100
ORDER BY idx_blks_read DESC
LIMIT 20;

-- SECTION 11: RLS Policies Inventory
-- =============================================================
\echo '=== SECTION 11: RLS POLICIES ==='

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  left(qual::text, 300) AS using_expression,
  left(with_check::text, 300) AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Tables with RLS enabled
SELECT 
  n.nspname AS schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
ORDER BY c.relname;

-- SECTION 12: Function Performance (if tracked)
-- =============================================================
\echo '=== SECTION 12: RPC/FUNCTION USAGE ==='

-- Functions that are called frequently based on pg_stat_statements
SELECT 
  left(query, 200) AS query_preview,
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS avg_time_ms
FROM extensions.pg_stat_statements
WHERE query LIKE '%SELECT%FROM%public.%(%'
   OR query LIKE 'SELECT public.%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- SECTION 13: Autovacuum Settings
-- =============================================================
\echo '=== SECTION 13: AUTOVACUUM CONFIGURATION ==='

SELECT name, setting, unit, short_desc
FROM pg_settings
WHERE name LIKE '%autovacuum%'
   OR name LIKE '%vacuum%'
ORDER BY name;

-- SECTION 14: Database-wide Stats Summary
-- =============================================================
\echo '=== SECTION 14: DATABASE SUMMARY ==='

SELECT 
  pg_database.datname AS database,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
  numbackends AS active_connections,
  xact_commit AS commits,
  xact_rollback AS rollbacks,
  blks_read,
  blks_hit,
  round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS cache_hit_pct,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted,
  conflicts,
  deadlocks
FROM pg_stat_database
JOIN pg_database ON pg_database.datname = pg_stat_database.datname
WHERE pg_database.datname = current_database();

-- SECTION 15: Disk I/O Stats
-- =============================================================
\echo '=== SECTION 15: DISK I/O STATS ==='

SELECT 
  relname,
  heap_blks_read,
  heap_blks_hit,
  idx_blks_read,
  idx_blks_hit,
  toast_blks_read,
  toast_blks_hit
FROM pg_statio_user_tables
WHERE schemaname = 'public'
ORDER BY heap_blks_read + idx_blks_read DESC
LIMIT 15;

\echo '=== BASELINE DISCOVERY COMPLETE ==='
