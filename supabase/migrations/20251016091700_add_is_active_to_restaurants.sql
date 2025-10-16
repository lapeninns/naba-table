-- Migration: Add is_active column to restaurants
-- Description: Adds an active flag to restaurants for capacity engine policies
-- Story: Capacity & Availability Engine - Prerequisites
-- Date: 2025-10-16

-- =====================================================
-- 1. Add is_active column (defaults to true for existing rows)
-- =====================================================
ALTER TABLE "public"."restaurants"
ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN "public"."restaurants"."is_active" IS 'Indicates whether the restaurant is active and should surface in public experiences.';

-- =====================================================
-- 2. Create supporting index (optional in case it does not exist)
-- =====================================================
CREATE INDEX IF NOT EXISTS "idx_restaurants_active" ON "public"."restaurants" ("is_active");

-- =====================================================
-- Migration complete
-- =====================================================
