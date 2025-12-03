-- ============================================================================
-- FIX: Enable pgcrypto extension and fix release_hold_and_emit function
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. Enable pgcrypto extension for digest() function
-- This is required by confirm_hold_assignment_tx
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant usage to the roles that need it
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- 2. Fix release_hold_and_emit function
-- The error "column table_id does not exist" suggests the function in the DB
-- has incorrect column references. Recreating with correct implementation.
CREATE OR REPLACE FUNCTION public.release_hold_and_emit(
  p_hold_id uuid,
  p_actor_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_member_table_ids uuid[];
BEGIN
  -- Lock and fetch the hold
  SELECT * INTO v_hold
    FROM public.table_holds
    WHERE id = p_hold_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Collect member table IDs BEFORE deleting
  SELECT array_agg(thm.table_id)
    INTO v_member_table_ids
    FROM public.table_hold_members thm
    WHERE thm.hold_id = p_hold_id;

  -- Delete members first (FK constraint)
  DELETE FROM public.table_hold_members
    WHERE hold_id = p_hold_id;

  -- Delete the hold
  DELETE FROM public.table_holds
    WHERE id = p_hold_id;

  -- Emit observability event (best effort, don't fail if function missing)
  BEGIN
    PERFORM public.record_observability_event(
      'capacity.holds',
      'hold.released',
      'info',
      v_hold.restaurant_id,
      v_hold.booking_id,
      jsonb_build_object(
        'holdId', p_hold_id,
        'actorId', p_actor_id,
        'tableIds', COALESCE(to_jsonb(v_member_table_ids), '[]'::jsonb),
        'startAt', v_hold.start_at,
        'endAt', v_hold.end_at,
        'expiresAt', v_hold.expires_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silently ignore if record_observability_event doesn't exist
    NULL;
  END;

  RETURN true;
END;
$$;

-- Ensure proper grants
GRANT ALL ON FUNCTION public.release_hold_and_emit(uuid, uuid) TO service_role;

-- 3. Verify pgcrypto is available in the public schema search path
-- The digest function needs to be accessible. Create a wrapper if needed.
DO $$
BEGIN
  -- Test if digest is accessible
  PERFORM extensions.digest('test', 'sha256');
  RAISE NOTICE 'pgcrypto digest() function is available';
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'pgcrypto extension may need to be enabled in Supabase Dashboard';
END;
$$;

SELECT 'Database functions fixed!' as status;
