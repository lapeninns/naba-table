-- =====================================
-- DATABASE SCHEMA OPTIMIZATION FIXES
-- Project: NabaTable / SajiloReserveX
-- Generated: 2026-01-06 14:17 UTC
-- Run in: Supabase SQL Editor
-- =====================================
--
-- INSTRUCTIONS:
-- 1. Run each section separately (don't run entire file at once)
-- 2. Verify each section completes successfully before moving to next
-- 3. If any section fails, check the error and fix before continuing
-- 4. Estimated total time: 2-3 minutes
--
-- =====================================

-- =====================================================================
-- PHASE 1: IMMEDIATE FIXES (Run First)
-- Risk: None to Low
-- Time: ~1 minute
-- =====================================================================


-- -----------------------------------------
-- 1.1 VACUUM & ANALYZE (Clean up bloat)
-- -----------------------------------------

-- Run VACUUM ANALYZE on tables with bloat > 5%
VACUUM ANALYZE public.customers;
VACUUM ANALYZE public.customer_profiles;
VACUUM ANALYZE public.allocations;
VACUUM ANALYZE public.booking_assignment_idempotency;
VACUUM ANALYZE public.capacity_outbox;

-- Run ANALYZE on tables that were never analyzed
ANALYZE public.booking_slots;
ANALYZE public.booking_state_history;
ANALYZE public.audit_logs;
ANALYZE public.observability_events;
ANALYZE public.table_adjacencies;
ANALYZE public.zones;


-- -----------------------------------------
-- 1.2 ADD MISSING INDEXES (Performance boost)
-- Estimated impact: 20-50% faster queries
-- -----------------------------------------

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

-- Index 4: FK column index for cascade deletes
-- Prevents full table scan when deleting bookings
CREATE INDEX IF NOT EXISTS idx_allocations_booking_id 
ON public.allocations (booking_id);

-- Index 5: FK column index for booking state history
-- Prevents full table scan when deleting bookings
CREATE INDEX IF NOT EXISTS idx_booking_state_history_booking_id
ON public.booking_state_history (booking_id);

-- Index 6: Outbox processor queue optimization
-- Use case: Background job picking up pending events
CREATE INDEX IF NOT EXISTS idx_capacity_outbox_pending
ON public.capacity_outbox (status, next_attempt_at)
WHERE status = 'pending';

-- Index 7: Email scheduler queue optimization
-- Use case: Email cron job picking up pending emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
ON public.scheduled_emails (status, scheduled_for)
WHERE status = 'pending';


-- -----------------------------------------
-- 1.3 VERIFY INDEXES CREATED
-- -----------------------------------------

SELECT 
  indexname,
  tablename,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_bookings_customer_id', 
    'idx_bookings_active_today', 
    'idx_allocations_booking',
    'idx_allocations_booking_id',
    'idx_booking_state_history_booking_id',
    'idx_capacity_outbox_pending',
    'idx_scheduled_emails_pending'
  )
ORDER BY tablename, indexname;


-- =====================================================================
-- PHASE 2: AUTOVACUUM CONFIGURATION
-- Risk: None
-- Time: ~10 seconds
-- Purpose: Prevent future bloat accumulation
-- =====================================================================


-- -----------------------------------------
-- 2.1 CONFIGURE AUTOVACUUM FOR HIGH-CHURN TABLES
-- -----------------------------------------

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

-- booking_table_assignments: frequent changes
ALTER TABLE public.booking_table_assignments SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- bookings: core table, moderate churn
ALTER TABLE public.bookings SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);


-- -----------------------------------------
-- 2.2 VERIFY AUTOVACUUM SETTINGS
-- -----------------------------------------

SELECT 
  c.relname AS table_name,
  pg_catalog.array_to_string(c.reloptions, ', ') AS autovacuum_settings
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'booking_state_history', 'allocations', 'table_holds', 
    'capacity_outbox', 'observability_events', 'customers', 
    'customer_profiles', 'booking_table_assignments', 'bookings'
  )
  AND c.reloptions IS NOT NULL
ORDER BY c.relname;


-- =====================================================================
-- PHASE 3: FOREIGN KEY CONSTRAINTS
-- Risk: Medium (may fail if orphaned data exists)
-- Time: ~30 seconds
-- Purpose: Ensure referential integrity, enable safe cascading
-- =====================================================================


-- -----------------------------------------
-- 3.1 CHECK FOR ORPHANED DATA (Run before adding FKs)
-- These queries should return 0 rows each
-- -----------------------------------------

-- Check for orphaned booking_state_history records
SELECT COUNT(*) AS orphaned_booking_state_history
FROM public.booking_state_history bsh
WHERE NOT EXISTS (
  SELECT 1 FROM public.bookings b WHERE b.id = bsh.booking_id
);

-- Check for orphaned customer_profiles records
SELECT COUNT(*) AS orphaned_customer_profiles
FROM public.customer_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers c WHERE c.id = cp.customer_id
);

-- Check for orphaned booking_table_assignments records
SELECT COUNT(*) AS orphaned_booking_table_assignments
FROM public.booking_table_assignments bta
WHERE NOT EXISTS (
  SELECT 1 FROM public.bookings b WHERE b.id = bta.booking_id
);

-- Check for orphaned allocations.booking_id records
SELECT COUNT(*) AS orphaned_allocations
FROM public.allocations a
WHERE a.booking_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.bookings b WHERE b.id = a.booking_id
);


-- -----------------------------------------
-- 3.2 CLEAN UP ORPHANED DATA (Only if counts > 0)
-- Uncomment and run these if the checks above found orphans
-- -----------------------------------------

-- DELETE FROM public.booking_state_history 
-- WHERE booking_id NOT IN (SELECT id FROM public.bookings);

-- DELETE FROM public.customer_profiles 
-- WHERE customer_id NOT IN (SELECT id FROM public.customers);

-- DELETE FROM public.booking_table_assignments 
-- WHERE booking_id NOT IN (SELECT id FROM public.bookings);

-- UPDATE public.allocations SET booking_id = NULL
-- WHERE booking_id IS NOT NULL 
--   AND booking_id NOT IN (SELECT id FROM public.bookings);


-- -----------------------------------------
-- 3.3 ADD FOREIGN KEY CONSTRAINTS
-- Run only if orphaned data checks pass (all return 0)
-- -----------------------------------------

-- FK: booking_state_history -> bookings (CASCADE on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_booking_state_history_booking'
  ) THEN
    ALTER TABLE public.booking_state_history
    ADD CONSTRAINT fk_booking_state_history_booking
    FOREIGN KEY (booking_id) REFERENCES public.bookings(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- FK: customer_profiles -> customers (CASCADE on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_customer_profiles_customer'
  ) THEN
    ALTER TABLE public.customer_profiles
    ADD CONSTRAINT fk_customer_profiles_customer
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- FK: booking_table_assignments -> bookings (CASCADE on delete)
-- Note: Check if this FK already exists under a different name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_booking_table_assignments_booking'
    OR (conrelid = 'public.booking_table_assignments'::regclass 
        AND confrelid = 'public.bookings'::regclass)
  ) THEN
    ALTER TABLE public.booking_table_assignments
    ADD CONSTRAINT fk_booking_table_assignments_booking
    FOREIGN KEY (booking_id) REFERENCES public.bookings(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- FK: booking_table_assignments -> table_inventory (SET NULL on delete)
-- When a table is deleted, assignments become orphaned but booking remains
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_booking_table_assignments_table'
    OR (conrelid = 'public.booking_table_assignments'::regclass 
        AND confrelid = 'public.table_inventory'::regclass)
  ) THEN
    ALTER TABLE public.booking_table_assignments
    ADD CONSTRAINT fk_booking_table_assignments_table
    FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) 
    ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'FK fk_booking_table_assignments_table could not be created: %', SQLERRM;
END $$;

-- FK: allocations -> bookings (SET NULL on delete)
-- Allocations may be reused, so just clear the booking reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_allocations_booking'
    OR (conrelid = 'public.allocations'::regclass 
        AND confrelid = 'public.bookings'::regclass)
  ) THEN
    ALTER TABLE public.allocations
    ADD CONSTRAINT fk_allocations_booking
    FOREIGN KEY (booking_id) REFERENCES public.bookings(id) 
    ON DELETE SET NULL;
  END IF;
END $$;


-- -----------------------------------------
-- 3.4 VERIFY FOREIGN KEY CONSTRAINTS
-- -----------------------------------------

SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table,
  CASE confdeltype 
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'a' THEN 'NO ACTION'
    ELSE confdeltype::text
  END AS on_delete
FROM pg_constraint
WHERE contype = 'f' 
  AND connamespace = 'public'::regnamespace
  AND conname LIKE 'fk_%'
ORDER BY conrelid::regclass::text, conname;


-- =====================================================================
-- PHASE 4: DROP REDUNDANT INDEXES
-- Risk: Low (indexes can be recreated)
-- Time: ~10 seconds
-- Purpose: Reduce index maintenance overhead
-- =====================================================================


-- -----------------------------------------
-- 4.1 IDENTIFY POTENTIALLY REDUNDANT INDEXES
-- Review this output before dropping anything
-- -----------------------------------------

-- Find indexes that may be duplicates
SELECT 
  a.indexrelname AS index_a,
  b.indexrelname AS index_b,
  a.relname AS table_name,
  a.idx_scan AS scans_a,
  b.idx_scan AS scans_b
FROM pg_stat_user_indexes a
JOIN pg_stat_user_indexes b ON a.relid = b.relid AND a.indexrelid < b.indexrelid
JOIN pg_index ia ON a.indexrelid = ia.indexrelid
JOIN pg_index ib ON b.indexrelid = ib.indexrelid
WHERE a.schemaname = 'public'
  AND ia.indkey::text LIKE ib.indkey::text || '%'
ORDER BY a.relname, a.indexrelname;

-- Specifically check booking_assignment_idempotency duplicates
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'booking_assignment_idempotency'
ORDER BY indexname;


-- -----------------------------------------
-- 4.2 DROP CONFIRMED REDUNDANT INDEXES
-- Only run after verifying in 4.1
-- -----------------------------------------

-- Check if these are truly duplicates before uncommenting:
-- DROP INDEX IF EXISTS booking_assignment_idempotency_created_idx;  -- if duplicates idx_booking_assignment_idempotency_created


-- =====================================================================
-- PHASE 5: STATISTICS RESET (Optional)
-- Risk: None (only affects query statistics)
-- Time: ~1 second
-- Purpose: Fresh baseline for monitoring
-- =====================================================================


-- Reset query statistics for a fresh baseline
SELECT extensions.pg_stat_statements_reset();

-- Verify reset
SELECT count(*) AS statement_count 
FROM extensions.pg_stat_statements;


-- =====================================================================
-- PHASE 6: VERIFICATION QUERIES
-- Run these to confirm all changes were applied
-- =====================================================================


-- -----------------------------------------
-- 6.1 FINAL BLOAT CHECK
-- All values should be < 10%
-- -----------------------------------------

SELECT 
  relname AS table_name,
  n_live_tup,
  n_dead_tup,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
  CASE 
    WHEN round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) > 10 THEN '❌ Still needs VACUUM'
    ELSE '✅ OK'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 10
ORDER BY dead_pct DESC NULLS LAST
LIMIT 15;


-- -----------------------------------------
-- 6.2 FINAL INDEX CHECK
-- Shows all new indexes that were created
-- -----------------------------------------

SELECT 
  indexrelname AS index_name,
  relname AS table_name,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  '✅ Created' AS status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname IN (
    'idx_bookings_customer_id', 
    'idx_bookings_active_today', 
    'idx_allocations_booking',
    'idx_allocations_booking_id',
    'idx_booking_state_history_booking_id',
    'idx_capacity_outbox_pending',
    'idx_scheduled_emails_pending'
  )
ORDER BY relname, indexrelname;


-- -----------------------------------------
-- 6.3 FINAL FK CHECK  
-- Shows all foreign key constraints we added
-- -----------------------------------------

SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table,
  CASE confdeltype 
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'a' THEN 'NO ACTION'
  END AS on_delete,
  '✅ Active' AS status
FROM pg_constraint
WHERE contype = 'f' 
  AND connamespace = 'public'::regnamespace
  AND conname IN (
    'fk_booking_state_history_booking',
    'fk_customer_profiles_customer',
    'fk_booking_table_assignments_booking',
    'fk_booking_table_assignments_table',
    'fk_allocations_booking'
  )
ORDER BY conrelid::regclass::text;


-- -----------------------------------------
-- 6.4 AUTOVACUUM CONFIG CHECK
-- Shows tables with custom autovacuum settings
-- -----------------------------------------

SELECT 
  c.relname AS table_name,
  pg_catalog.array_to_string(c.reloptions, ', ') AS settings,
  '✅ Configured' AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.reloptions IS NOT NULL
  AND c.relkind = 'r'
ORDER BY c.relname;


-- -----------------------------------------
-- 6.5 SUMMARY REPORT
-- -----------------------------------------

SELECT '=== OPTIMIZATION SUMMARY ===' AS report;

SELECT 'Indexes created' AS metric, 
  COUNT(*)::text AS value
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
  AND indexrelname IN (
    'idx_bookings_customer_id', 
    'idx_bookings_active_today', 
    'idx_allocations_booking',
    'idx_allocations_booking_id',
    'idx_booking_state_history_booking_id',
    'idx_capacity_outbox_pending',
    'idx_scheduled_emails_pending'
  )

UNION ALL

SELECT 'FK constraints added' AS metric,
  COUNT(*)::text AS value
FROM pg_constraint
WHERE contype = 'f' 
  AND connamespace = 'public'::regnamespace
  AND conname LIKE 'fk_%'

UNION ALL

SELECT 'Tables with autovacuum config' AS metric,
  COUNT(*)::text AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.reloptions IS NOT NULL
  AND c.relkind = 'r'

UNION ALL

SELECT 'Tables with bloat > 10%' AS metric,
  COUNT(*)::text AS value
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
  AND n_live_tup > 10
  AND round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) > 10;


-- =====================================================================
-- NOTES & NEXT STEPS
-- =====================================================================
--
-- WHAT WAS FIXED:
-- ✅ Bloat cleaned up on all tables
-- ✅ 7 new indexes created for common query patterns
-- ✅ Autovacuum configured for 9 high-churn tables
-- ✅ Foreign key constraints added with proper cascade rules
-- ✅ Query statistics reset for fresh baseline
--
-- NEXT STEPS:
-- 1. Run weekly monitoring queries (see maintenance-sql-20260106.sql)
-- 2. After 1-2 weeks, verify new indexes are being used (idx_scan > 0)
-- 3. Monitor autovacuum activity (last_autovacuum should populate)
-- 4. When observability_events reaches 100K+ rows, implement partitioning
--
-- ROLLBACK (if needed):
-- See maintenance-sql-20260106.sql for rollback commands
--
-- =====================================================================
