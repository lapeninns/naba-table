-- Drop useless tables
-- Generated: 2025-12-02T14:49:49.432Z
-- This removes tables that are not used in the codebase

BEGIN;

DROP TABLE IF EXISTS "loyalty_point_events" CASCADE;
DROP TABLE IF EXISTS "loyalty_points" CASCADE;
DROP TABLE IF EXISTS "loyalty_programs" CASCADE;
DROP TABLE IF EXISTS "booking_assignment_idempotency" CASCADE;
DROP TABLE IF EXISTS "booking_confirmation_results" CASCADE;
DROP TABLE IF EXISTS "booking_versions" CASCADE;
DROP TABLE IF EXISTS "booking_occasions_audit" CASCADE;
DROP TABLE IF EXISTS "table_hold_members" CASCADE;
DROP TABLE IF EXISTS "table_hold_windows" CASCADE;
DROP TABLE IF EXISTS "table_scarcity_metrics" CASCADE;
DROP TABLE IF EXISTS "user_profiles" CASCADE;
DROP TABLE IF EXISTS "analytics_events" CASCADE;
DROP TABLE IF EXISTS "demand_profiles" CASCADE;
DROP TABLE IF EXISTS "strategic_configs" CASCADE;
DROP TABLE IF EXISTS "restaurant_capacity_rules" CASCADE;

COMMIT;

-- After running, verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
