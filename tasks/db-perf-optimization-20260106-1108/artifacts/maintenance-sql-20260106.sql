-- =====================================
-- DATABASE MAINTENANCE SQL COMMANDS
-- Project: NabaTable / SajiloReserveX
-- Generated: 2026-01-06 13:52 UTC
-- Run in: Supabase SQL Editor
-- =====================================

-- =====================================================================
-- ACTION 1: CLEAN UP REMAINING BLOAT
-- Status: Run immediately
-- Risk: None
-- Time: ~30 seconds
-- =====================================================================

-- Run VACUUM ANALYZE on tables with bloat > 5%
VACUUM ANALYZE public.customers;
VACUUM ANALYZE public.customer_profiles;
VACUUM ANALYZE public.allocations;
VACUUM ANALYZE public.booking_assignment_idempotency;
VACUUM ANALYZE public.capacity_outbox;

-- Verify bloat is cleaned
SELECT 
  relname AS table_name,
  n_live_tup,
  n_dead_tup,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
  AND relname IN ('customers', 'customer_profiles', 'allocations', 
                  'booking_assignment_idempotency', 'capacity_outbox')
ORDER BY dead_pct DESC NULLS LAST;


-- =====================================================================
-- ACTION 2: CREATE MISSING INDEXES
-- Status: Run after Action 1
-- Risk: Low (brief lock on small tables)
-- Time: ~10 seconds
-- Note: Cannot use CONCURRENTLY in Supabase SQL Editor transactions
-- =====================================================================

-- Index 1: Customer lookup on bookings
-- Use case: Customer booking history, customer detail pages
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id 
ON public.bookings (customer_id, booking_date DESC);

-- Index 2: Active bookings filter (partial index)
-- Use case: Dashboard queries, today's reservations list
CREATE INDEX IF NOT EXISTS idx_bookings_active_today
ON public.bookings (restaurant_id, booking_date)
WHERE status IN ('confirmed', 'pending', 'checked_in');

-- Index 3: Allocation booking lookup
-- Use case: Finding allocations for a specific booking
CREATE INDEX IF NOT EXISTS idx_allocations_booking
ON public.allocations (booking_id)
WHERE booking_id IS NOT NULL;

-- Verify new indexes exist
SELECT 
  indexname,
  tablename,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_bookings_customer_id', 'idx_bookings_active_today', 'idx_allocations_booking');


-- =====================================================================
-- ACTION 2B: SCHEMA OPTIMIZATION INDEXES
-- Status: Run after Action 2
-- Risk: Low (brief lock on small tables)
-- Time: ~10 seconds
-- Purpose: Add missing indexes for FK columns and queue processing
-- Reference: See schema-optimization-review.md for full analysis
-- =====================================================================

-- Index for FK column: allocations.booking_id (prevents slow cascade deletes)
CREATE INDEX IF NOT EXISTS idx_allocations_booking_id 
ON public.allocations (booking_id);

-- Index for FK column: booking_state_history.booking_id
CREATE INDEX IF NOT EXISTS idx_booking_state_history_booking_id
ON public.booking_state_history (booking_id);

-- Index for outbox processor: pending events queue
CREATE INDEX IF NOT EXISTS idx_capacity_outbox_pending
ON public.capacity_outbox (status, next_attempt_at)
WHERE status = 'pending';

-- Index for email scheduler: pending emails queue
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
ON public.scheduled_emails (status, scheduled_for)
WHERE status = 'pending';

-- Verify schema optimization indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname IN (
    'idx_allocations_booking_id',
    'idx_booking_state_history_booking_id',
    'idx_capacity_outbox_pending',
    'idx_scheduled_emails_pending'
  );


-- =====================================================================
-- ACTION 3: CONFIGURE AUTOVACUUM FOR HIGH-CHURN TABLES
-- Status: Run after Action 2
-- Risk: None
-- Time: ~5 seconds
-- =====================================================================

-- booking_state_history: append-only, many inserts
ALTER TABLE public.booking_state_history SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

-- allocations: frequent inserts/updates during booking flow
ALTER TABLE public.allocations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- table_holds: frequent creation/expiration
ALTER TABLE public.table_holds SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- capacity_outbox: high-volume event queue
ALTER TABLE public.capacity_outbox SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- observability_events: high-volume logging
ALTER TABLE public.observability_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- customers: moderate updates
ALTER TABLE public.customers SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- customer_profiles: moderate updates
ALTER TABLE public.customer_profiles SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Verify autovacuum settings
SELECT 
  c.relname AS table_name,
  pg_catalog.array_to_string(c.reloptions, ', ') AS options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('booking_state_history', 'allocations', 'table_holds', 
                    'capacity_outbox', 'observability_events', 'customers', 'customer_profiles')
  AND c.reloptions IS NOT NULL;


-- =====================================================================
-- ACTION 4: RESET PG_STAT_STATEMENTS FOR CLEAN BASELINE
-- Status: Optional - run to get fresh query statistics
-- Risk: None (only affects statistics, not data)
-- Time: ~1 second
-- =====================================================================

-- Reset query statistics for a fresh baseline
SELECT extensions.pg_stat_statements_reset();

-- Verify reset
SELECT count(*) AS statement_count 
FROM extensions.pg_stat_statements;


-- =====================================================================
-- WEEKLY MAINTENANCE CHECK QUERIES
-- Status: Save and run every Monday morning
-- Schedule: Weekly
-- =====================================================================

-- -----------------------------------------
-- CHECK 1: Cache Hit Ratio (Target: ≥99%)
-- -----------------------------------------
SELECT 
  round(100.0 * sum(heap_blks_hit) / 
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_pct,
  CASE 
    WHEN round(100.0 * sum(heap_blks_hit) / 
      NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 99 
    THEN '✅ Excellent'
    WHEN round(100.0 * sum(heap_blks_hit) / 
      NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) >= 95 
    THEN '⚠️ Acceptable'
    ELSE '❌ Needs attention'
  END AS status
FROM pg_statio_user_tables;


-- -----------------------------------------
-- CHECK 2: Table Bloat (Target: <10%)
-- -----------------------------------------
SELECT 
  relname AS table_name,
  n_live_tup,
  n_dead_tup,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
  last_vacuum,
  last_autovacuum,
  CASE 
    WHEN round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) > 20 THEN '❌ VACUUM FULL needed'
    WHEN round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) > 10 THEN '⚠️ VACUUM needed'
    ELSE '✅ OK'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 50
ORDER BY dead_pct DESC NULLS LAST
LIMIT 15;


-- -----------------------------------------
-- CHECK 3: Unused Indexes (Candidates for removal)
-- -----------------------------------------
SELECT 
  sui.indexrelname AS index_name,
  sui.relname AS table_name,
  pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size,
  sui.idx_scan AS scans
FROM pg_stat_user_indexes sui
WHERE sui.schemaname = 'public'
  AND sui.idx_scan = 0
  AND sui.indexrelid NOT IN (
    SELECT conindid FROM pg_constraint WHERE contype IN ('p', 'u')
  )
ORDER BY pg_relation_size(sui.indexrelid) DESC
LIMIT 15;


-- -----------------------------------------
-- CHECK 4: Top 10 Slowest Queries
-- -----------------------------------------
SELECT 
  left(query, 150) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM extensions.pg_stat_statements
WHERE query NOT LIKE 'COMMIT%' 
  AND query NOT LIKE 'BEGIN%'
  AND query NOT LIKE 'COPY%'
  AND calls > 5
ORDER BY mean_exec_time DESC
LIMIT 10;


-- -----------------------------------------
-- CHECK 5: Index Usage Summary
-- -----------------------------------------
SELECT 
  count(*) FILTER (WHERE idx_scan > 100) AS hot_indexes,
  count(*) FILTER (WHERE idx_scan BETWEEN 1 AND 100) AS warm_indexes,
  count(*) FILTER (WHERE idx_scan = 0) AS cold_indexes,
  pg_size_pretty(sum(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0)) AS cold_index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public';


-- -----------------------------------------
-- CHECK 6: New Index Usage Validation
-- -----------------------------------------
SELECT 
  indexrelname AS index_name,
  relname AS table_name,
  idx_scan,
  idx_tup_read,
  CASE 
    WHEN idx_scan > 100 THEN '🔥 Hot - actively used'
    WHEN idx_scan > 0 THEN '✅ Warm - being used'
    ELSE '⏳ Cold - not yet used'
  END AS status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname IN (
    'idx_bookings_customer_id',
    'idx_bookings_active_today', 
    'idx_allocations_booking',
    'idx_booking_state_history_booking'
  )
ORDER BY idx_scan DESC;


-- -----------------------------------------
-- CHECK 7: Autovacuum Activity
-- -----------------------------------------
SELECT 
  relname AS table_name,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  n_dead_tup,
  CASE 
    WHEN last_autovacuum IS NOT NULL THEN '✅ Autovacuum running'
    WHEN last_vacuum IS NOT NULL THEN '⚠️ Manual vacuum only'
    ELSE '❌ Never vacuumed'
  END AS vacuum_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('booking_state_history', 'allocations', 'table_holds', 
                  'capacity_outbox', 'observability_events', 'customers', 
                  'customer_profiles', 'bookings', 'booking_table_assignments')
ORDER BY relname;


-- =====================================================================
-- ROLLBACK COMMANDS (If needed)
-- =====================================================================

-- Rollback: Remove new indexes
-- DROP INDEX IF EXISTS idx_bookings_customer_id;
-- DROP INDEX IF EXISTS idx_bookings_active_today;
-- DROP INDEX IF EXISTS idx_allocations_booking;

-- Rollback: Reset autovacuum to defaults
-- ALTER TABLE public.booking_state_history RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.allocations RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.table_holds RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.capacity_outbox RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.observability_events RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.customers RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
-- ALTER TABLE public.customer_profiles RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);


-- =====================================================================
-- NOTES
-- =====================================================================
-- 
-- 1. Run Actions 1-4 in order during a low-traffic period
-- 2. Run weekly checks every Monday morning
-- 3. After 1-2 weeks, re-check index usage (CHECK 6) to validate new indexes
-- 4. If autovacuum still not running after 1 week, contact Supabase support
-- 5. Keep this file for reference and future maintenance
--
-- Target Metrics:
-- - Cache Hit Ratio: ≥99%
-- - Table Bloat: <10%
-- - Slow Queries: <100ms mean time
-- - All created indexes: idx_scan > 0 after 1-2 weeks
--
-- =====================================================================
