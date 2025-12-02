-- Migration: Verify schema for single restaurant seed
-- This migration ensures all required tables and constraints are in place
-- for the single restaurant seed with 2 zones and 50 bookings.
-- No actual schema changes needed as base schema is already established.

-- Verification comments
COMMENT ON TABLE public.restaurants IS 'Restaurant entities with timezone and capacity configuration';
COMMENT ON TABLE public.zones IS 'Dining zones within restaurants (e.g., Dining 1, Dining 2)';
COMMENT ON TABLE public.table_inventory IS 'Physical tables with capacity, mobility, and zone assignment';
COMMENT ON TABLE public.bookings IS 'Customer reservations with party size, time, and status';
COMMENT ON TABLE public.customers IS 'Guest profiles with contact details';
-- Ensure table_mobility enum includes 'movable'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'table_mobility' AND e.enumlabel = 'movable'
    ) THEN
        RAISE EXCEPTION 'table_mobility enum missing ''movable'' value';
    END IF;
END $$;
-- Success
SELECT 'Schema verification complete for single restaurant seed' AS status;
