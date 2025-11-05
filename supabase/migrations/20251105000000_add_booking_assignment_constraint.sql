-- Migration: Add data integrity constraint for booking assignments
-- Purpose: Prevent orphaned bookings (confirmed status with 0 table assignments)
-- Date: 2025-11-05
-- 
-- ISSUE FIXED:
-- During testing, we found 16 confirmed bookings that had zero table assignments.
-- This indicates a transaction handling bug where bookings can transition to 
-- "confirmed" status without having any tables actually assigned.
--
-- This migration adds a database-level CHECK constraint to enforce that:
-- - Confirmed bookings MUST have at least one table assignment
-- - Prevents data integrity issues at the database level
-- - Fails fast if application logic tries to confirm without assigning tables

-- ============================================================================
-- OPTION 1: Add a trigger-based validation (RECOMMENDED)
-- ============================================================================
-- Triggers are more flexible and can provide better error messages

CREATE OR REPLACE FUNCTION validate_booking_has_assignments()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when status is being changed to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Check if this booking has any table assignments
    IF NOT EXISTS (
      SELECT 1 
      FROM booking_table_assignments 
      WHERE booking_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot confirm booking %: No table assignments exist. Booking must have at least one table assigned before confirmation.', NEW.id
        USING HINT = 'Use the assign_tables RPC function to assign tables before confirming';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE UPDATE on bookings table
DROP TRIGGER IF EXISTS booking_assignment_validation ON bookings;
CREATE TRIGGER booking_assignment_validation
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION validate_booking_has_assignments();

COMMENT ON FUNCTION validate_booking_has_assignments IS 
  'Validates that confirmed bookings have at least one table assignment. Prevents orphaned confirmations.';

-- ============================================================================
-- OPTION 2: Add a CHECK constraint (Alternative - more rigid)
-- ============================================================================
-- Uncomment below if you prefer constraint over trigger
-- Note: CHECK constraints cannot reference other tables directly in PostgreSQL,
-- so this would require a different approach using a materialized view or 
-- computed column. The trigger approach above is recommended.

-- Example of what we'd like (not directly possible in PostgreSQL):
-- ALTER TABLE bookings ADD CONSTRAINT booking_must_have_tables 
--   CHECK (
--     status != 'confirmed' OR 
--     EXISTS (SELECT 1 FROM booking_table_assignments WHERE booking_id = id)
--   );

-- ============================================================================
-- Add index to improve trigger performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_booking_id 
  ON booking_table_assignments(booking_id);

COMMENT ON INDEX idx_booking_table_assignments_booking_id IS 
  'Improves performance of booking assignment validation trigger';

-- ============================================================================
-- Data migration: Find and fix any existing orphaned bookings
-- ============================================================================

DO $$
DECLARE
  orphan_count INT;
BEGIN
  -- Find confirmed bookings with no assignments
  WITH orphaned_bookings AS (
    SELECT b.id, b.status, b.created_at
    FROM bookings b
    WHERE b.status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 
        FROM booking_table_assignments bta 
        WHERE bta.booking_id = b.id
      )
  )
  SELECT COUNT(*) INTO orphan_count FROM orphaned_bookings;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % orphaned confirmed bookings. Resetting to pending status...', orphan_count;
    
    -- Reset orphaned bookings to pending
    UPDATE bookings
    SET 
      status = 'pending',
      assigned_zone_id = NULL,
      updated_at = NOW()
    WHERE status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 
        FROM booking_table_assignments bta 
        WHERE bta.booking_id = id
      );
    
    RAISE NOTICE 'Successfully reset % orphaned bookings to pending status', orphan_count;
  ELSE
    RAISE NOTICE 'No orphaned confirmed bookings found - data integrity is good!';
  END IF;
END $$;
