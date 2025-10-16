-- Migration: Add auth_user_id column to bookings
-- Description: Adds authenticated user linkage needed for capacity engine policies
-- Story: Capacity & Availability Engine - Prerequisites
-- Date: 2025-10-16

-- =====================================================
-- 1. Add auth_user_id column (nullable)
-- =====================================================
ALTER TABLE "public"."bookings"
ADD COLUMN IF NOT EXISTS "auth_user_id" "uuid";

COMMENT ON COLUMN "public"."bookings"."auth_user_id" IS 'Optional link to the authenticated Supabase user that created or owns the booking.';

-- =====================================================
-- 2. Create index to speed up lookups (no-op if it already exists)
-- =====================================================
CREATE INDEX IF NOT EXISTS "idx_bookings_auth_user" ON "public"."bookings" ("auth_user_id") WHERE "auth_user_id" IS NOT NULL;

-- =====================================================
-- Migration complete
-- =====================================================
