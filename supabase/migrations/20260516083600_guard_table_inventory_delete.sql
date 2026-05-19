CREATE OR REPLACE FUNCTION public.delete_table_inventory_guarded(
  p_table_id uuid,
  p_current_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT restaurant_id
    INTO v_restaurant_id
  FROM public.table_inventory
  WHERE id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_table_assignments bta
    JOIN public.bookings b ON b.id = bta.booking_id
    WHERE bta.table_id = p_table_id
      AND b.restaurant_id = v_restaurant_id
      AND COALESCE(b.status::text, '') NOT IN ('cancelled', 'no_show', 'completed')
      AND b.booking_date >= p_current_date
  ) THEN
    RAISE EXCEPTION 'Cannot delete table with active or future booking assignments'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.table_inventory
  WHERE id = p_table_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_table_inventory_guarded(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_table_inventory_guarded(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.delete_table_inventory_guarded(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_table_inventory_guarded(uuid, date) TO service_role;
