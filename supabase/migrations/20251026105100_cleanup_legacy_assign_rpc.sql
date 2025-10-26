-- Remove legacy assign_table_to_booking RPC
-- This migration drops the old function signature if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'assign_table_to_booking'
      AND pg_function_is_visible(oid)
      AND pg_get_function_identity_arguments(oid) = 'p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_notes text'
  ) THEN
    DROP FUNCTION public.assign_table_to_booking(uuid, uuid, uuid, text);
  END IF;
END;
$$;
