-- Migration: Capacity Engine Rollback
-- Description: Safely rollback all capacity engine changes if needed
-- Story: Capacity & Availability Engine - Story 1
-- Date: 2025-10-16
-- 
-- IMPORTANT: Only run this if you need to rollback the capacity engine.
-- This will drop all new tables and functions.
-- 
-- To rollback, run: psql -f 20251016092200_capacity_engine_rollback.sql

-- =====================================================
-- 1. Drop RPC Function
-- =====================================================
DROP FUNCTION IF EXISTS "public"."create_booking_with_capacity_check"(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer
) CASCADE;

-- =====================================================
-- 2. Drop Helper Functions
-- =====================================================
DROP FUNCTION IF EXISTS "public"."unassign_table_from_booking"(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS "public"."assign_table_to_booking"(uuid, uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS "public"."log_table_assignment_change"() CASCADE;
DROP FUNCTION IF EXISTS "public"."get_or_create_booking_slot"(uuid, date, time, integer) CASCADE;
DROP FUNCTION IF EXISTS "public"."increment_booking_slot_version"() CASCADE;

-- =====================================================
-- 3. Drop Tables (in reverse order of creation)
-- =====================================================
DROP TABLE IF EXISTS "public"."booking_table_assignments" CASCADE;
DROP TABLE IF EXISTS "public"."booking_slots" CASCADE;
DROP TABLE IF EXISTS "public"."table_inventory" CASCADE;

-- =====================================================
-- 4. Drop Enums
-- =====================================================
DROP TYPE IF EXISTS "public"."table_status" CASCADE;

-- =====================================================
-- Rollback complete
-- =====================================================
-- All capacity engine changes have been removed.
-- The system will revert to the pre-capacity-engine state.
-- Existing bookings are NOT affected.
