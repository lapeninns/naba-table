-- ============================================================================
-- FIX: Remove Bar Table Booking Type Restriction
-- ============================================================================
-- Issue: Bar tables are blocked for lunch/dinner bookings with error:
--        "Bar tables are drinks-only; booking_type lunch is not allowed"
--
-- Root Cause: Trigger function `enforce_bar_drinks_only` blocks non-drinks 
--             bookings on tables with category='bar' OR zones named 'bar%'
--
-- Created: 2025-12-25
-- Session: ANTIGRAVITY_SESSION_HISTORY_20251225.md
-- ============================================================================


-- ============================================================================
-- DIAGNOSTIC QUERIES (Run first to understand current state)
-- ============================================================================

-- 1. Check for bar tables
SELECT 
    t.id,
    t.table_number,
    t.category,
    t.capacity,
    t.status,
    z.name as zone_name
FROM public.table_inventory t
LEFT JOIN public.zones z ON t.zone_id = z.id
WHERE t.category = 'bar' OR z.name ILIKE 'bar%'
ORDER BY z.name, t.table_number;

-- 2. Find the trigger function
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc ILIKE '%drinks-only%'
   OR prosrc ILIKE '%Bar tables are%';

-- 3. Find triggers using this function
SELECT 
    tgname as trigger_name,
    relname as table_name,
    tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'enforce_bar_drinks_only';

-- 4. Check table category distribution
SELECT category, COUNT(*) as count 
FROM public.table_inventory 
GROUP BY category 
ORDER BY category;


-- ============================================================================
-- THE FIX: Replace the trigger function with a no-op
-- ============================================================================
-- This permanently removes the bar/drinks-only constraint while keeping
-- the trigger infrastructure in place (safe for rollback if needed)

CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS TRIGGER AS $$
BEGIN
  -- =========================================================================
  -- Bar table restriction REMOVED (2025-12-25)
  -- =========================================================================
  -- Previously, this function blocked non-drinks bookings on:
  --   - Tables with category = 'bar'
  --   - Tables in zones with names starting with 'bar%'
  -- 
  -- This restriction has been removed per business requirements.
  -- Bar tables and bar zones can now be used for any booking type:
  --   - lunch
  --   - dinner  
  --   - drinks
  --
  -- See: docs/ANTIGRAVITY_SESSION_HISTORY_20251225.md
  -- See: docs/BUSINESS_LOGIC.md (line 637-638)
  -- =========================================================================
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION: Confirm the fix was applied
-- ============================================================================

-- Check the function now returns NEW without validation
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'enforce_bar_drinks_only';


-- ============================================================================
-- OPTIONAL: If you want to completely remove the trigger instead
-- ============================================================================
-- First find the trigger name and table:
-- SELECT tgname, relname FROM pg_trigger t 
-- JOIN pg_class c ON t.tgrelid = c.oid 
-- JOIN pg_proc p ON t.tgfoid = p.oid 
-- WHERE p.proname = 'enforce_bar_drinks_only';
--
-- Then drop it:
-- DROP TRIGGER IF EXISTS <trigger_name> ON public.<table_name>;


-- ============================================================================
-- ROLLBACK: If you need to restore the original behavior
-- ============================================================================
/*
CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_type bookings.booking_type%TYPE;
  v_table_category table_inventory.category%TYPE;
  v_zone_name text;
BEGIN
  SELECT b.booking_type INTO v_booking_type
  FROM public.bookings b
  WHERE b.id = NEW.booking_id
  LIMIT 1;

  IF v_booking_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.category, z.name
  INTO v_table_category, v_zone_name
  FROM public.table_inventory t
  LEFT JOIN public.zones z ON z.id = t.zone_id
  WHERE t.id = NEW.table_id
  LIMIT 1;

  IF v_table_category IS NULL THEN
    RETURN NEW;
  END IF;

  IF (v_table_category = 'bar'::public.table_category OR v_zone_name ILIKE 'bar%')
     AND v_booking_type <> 'drinks' THEN
    RAISE EXCEPTION 'Bar tables are drinks-only; booking_type % is not allowed', v_booking_type
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/
