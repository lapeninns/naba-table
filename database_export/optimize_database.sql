-- ============================================
-- DATABASE OPTIMIZATION & CLEANUP SCRIPT
-- Generated: December 2, 2025
-- Run in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- 1. DROP ORPHANED INDEXES (from dropped tables)
-- ============================================

-- Analytics events (dropped)
DROP INDEX IF EXISTS idx_analytics_events_booking_id;
DROP INDEX IF EXISTS idx_analytics_events_customer_id;
DROP INDEX IF EXISTS idx_analytics_events_event_type;
DROP INDEX IF EXISTS idx_analytics_events_occurred_at;
DROP INDEX IF EXISTS idx_analytics_events_restaurant_id;
DROP INDEX IF EXISTS idx_analytics_events_restaurant_occurred;
DROP INDEX IF EXISTS analytics_events_restaurant_occurred_idx;

-- Loyalty (dropped)
DROP INDEX IF EXISTS idx_loyalty_point_events_booking;
DROP INDEX IF EXISTS idx_loyalty_point_events_customer;
DROP INDEX IF EXISTS idx_loyalty_points_restaurant_customer;
DROP INDEX IF EXISTS idx_loyalty_programs_restaurant;

-- Capacity metrics hourly (dropped)
DROP INDEX IF EXISTS idx_capacity_metrics_hourly_window;

-- Stripe events (not used)
DROP INDEX IF EXISTS idx_stripe_events_created_at;
DROP INDEX IF EXISTS idx_stripe_events_event_id;
DROP INDEX IF EXISTS idx_stripe_events_event_type;
DROP INDEX IF EXISTS idx_stripe_events_processed;

-- Demand profiles (dropped)
DROP INDEX IF EXISTS idx_demand_profiles_restaurant_day_window;
DROP INDEX IF EXISTS idx_demand_profiles_updated_at;

-- Scarcity metrics (dropped)
DROP INDEX IF EXISTS idx_table_scarcity_metrics_computed_at;
DROP INDEX IF EXISTS idx_table_scarcity_metrics_restaurant_type;

-- User profiles (dropped)  
DROP INDEX IF EXISTS idx_user_profiles_phone;

-- Booking versions (dropped)
DROP INDEX IF EXISTS idx_booking_versions_booking_id;
DROP INDEX IF EXISTS idx_booking_versions_changed_at;
DROP INDEX IF EXISTS idx_booking_versions_restaurant_id;

-- ============================================
-- 2. DROP ORPHANED FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS capacity_metrics_hourly_updated_at() CASCADE;

-- ============================================
-- 3. DROP UNUSED TYPES (optional - uncomment if desired)
-- ============================================

-- DROP TYPE IF EXISTS analytics_event_type CASCADE;
-- DROP TYPE IF EXISTS loyalty_tier CASCADE;
-- DROP TYPE IF EXISTS capacity_override_type CASCADE;

COMMIT;

-- ============================================
-- 4. VACUUM & ANALYZE (run separately)
-- ============================================
-- Run this after the above commits:

VACUUM ANALYZE;

-- ============================================
-- 5. VERIFY CLEANUP - Run these queries
-- ============================================

-- List all remaining tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- List all indexes
SELECT 
    schemaname, 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check table sizes
SELECT 
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as data_size,
    pg_size_pretty(pg_indexes_size(relid)) as index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
