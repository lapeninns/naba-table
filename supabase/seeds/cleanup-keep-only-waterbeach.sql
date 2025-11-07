-- Cleanup: Keep only White Horse Pub (Waterbeach) and delete all other restaurants
-- Run remotely via: psql "$SUPABASE_DB_URL" -f supabase/seeds/cleanup-keep-only-waterbeach.sql

BEGIN;

-- Get the ID of White Horse Pub to preserve it
DO $$
DECLARE
  waterbeach_id uuid;
  deleted_count int;
BEGIN
  SELECT id INTO waterbeach_id 
  FROM public.restaurants 
  WHERE slug = 'white-horse-pub-waterbeach' 
  LIMIT 1;

  IF waterbeach_id IS NULL THEN
    RAISE EXCEPTION 'White Horse Pub (Waterbeach) not found! Cannot proceed with cleanup.';
  END IF;

  RAISE NOTICE 'Preserving White Horse Pub: %', waterbeach_id;

  -- Delete all data for restaurants that are NOT White Horse Pub
  -- Use restaurant_id directly where available
  
  -- Delete table hold windows (has restaurant_id)
  DELETE FROM public.table_hold_windows
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % table_hold_windows', deleted_count;

  -- Delete table hold members
  DELETE FROM public.table_hold_members
  WHERE hold_id IN (
    SELECT id FROM public.table_holds 
    WHERE restaurant_id != waterbeach_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % table_hold_members', deleted_count;

  -- Delete table holds
  DELETE FROM public.table_holds
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % table_holds', deleted_count;

  -- Delete booking-related data
  DELETE FROM public.booking_assignment_idempotency
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % booking_assignment_idempotency', deleted_count;

  DELETE FROM public.booking_table_assignments
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % booking_table_assignments', deleted_count;

  DELETE FROM public.allocations
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % allocations', deleted_count;

  DELETE FROM public.booking_slots
  WHERE booking_id IN (
    SELECT id FROM public.bookings 
    WHERE restaurant_id != waterbeach_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % booking_slots', deleted_count;

  DELETE FROM public.booking_state_history
  WHERE booking_id IN (
    SELECT id FROM public.bookings 
    WHERE restaurant_id != waterbeach_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % booking_state_history', deleted_count;

  DELETE FROM public.booking_versions
  WHERE booking_id IN (
    SELECT id FROM public.bookings 
    WHERE restaurant_id != waterbeach_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % booking_versions', deleted_count;

  DELETE FROM public.bookings
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % bookings', deleted_count;

  -- Delete restaurant configuration data
  DELETE FROM public.restaurant_invites
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % restaurant_invites', deleted_count;

  DELETE FROM public.restaurant_memberships
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % restaurant_memberships', deleted_count;

  DELETE FROM public.restaurant_operating_hours
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % restaurant_operating_hours', deleted_count;

  DELETE FROM public.restaurant_service_periods
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % restaurant_service_periods', deleted_count;

  DELETE FROM public.service_policy
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % service_policy', deleted_count;

  DELETE FROM public.feature_flag_overrides
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % feature_flag_overrides', deleted_count;

  -- Delete table and zone data
  DELETE FROM public.table_adjacencies
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % table_adjacencies', deleted_count;

  DELETE FROM public.table_inventory
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % table_inventory', deleted_count;

  DELETE FROM public.allowed_capacities
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % allowed_capacities', deleted_count;

  DELETE FROM public.zones
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % zones', deleted_count;

  -- Delete observability and analytics events
  DELETE FROM public.observability_events
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % observability_events', deleted_count;

  DELETE FROM public.analytics_events
  WHERE restaurant_id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % analytics_events', deleted_count;

  -- Finally, delete other restaurants
  DELETE FROM public.restaurants
  WHERE id != waterbeach_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % restaurants', deleted_count;

  RAISE NOTICE '=== Cleanup complete ===';
END $$;

-- Verify what remains
SELECT 
  'Restaurant:' as type,
  id, 
  name, 
  slug
FROM public.restaurants

UNION ALL

SELECT 
  'Operating Hours:' as type,
  restaurant_id as id,
  COUNT(*)::text as name,
  'records' as slug
FROM public.restaurant_operating_hours
GROUP BY restaurant_id

UNION ALL

SELECT 
  'Service Periods:' as type,
  restaurant_id as id,
  COUNT(*)::text as name,
  'records' as slug
FROM public.restaurant_service_periods
GROUP BY restaurant_id;

COMMIT;
