-- Atomic table inventory PATCH (ops table editor).
--
-- PATCH /api/ops/tables/[id] used to update table_inventory with the RLS client
-- and then delete/insert the maintenance allocation with a second (service)
-- client, reverting only `status` by hand when the second write failed. A failed
-- maintenance insert therefore left the other edited columns committed and the
-- previous maintenance window deleted. The allocation insert also sent a JSON
-- object as the tstzrange, so it could never succeed.
--
-- update_table_inventory_atomic applies the whitelisted column patch and the
-- maintenance allocation change in one transaction, scoped by restaurant_id:
--   * the table row is locked FOR UPDATE and must belong to p_restaurant_id
--     (otherwise P0002 'table_not_found');
--   * a changed zone must belong to the same restaurant (P0002 'zone_not_found');
--   * unknown or identity keys in p_patch raise 22023 instead of being ignored;
--   * status 'out_of_service' with a window replaces the table's maintenance
--     allocation; any other supplied status clears it; no status leaves it alone;
--   * the allocation insert still passes strict_allocation_hold_guard, so a live
--     hold raises 23P01 and the whole patch rolls back.
-- Authorization (owner/manager membership) stays in the route; the function is
-- granted to service_role only.
--
-- Rollback: DROP FUNCTION IF EXISTS public.update_table_inventory_atomic(uuid, uuid, jsonb, timestamptz, timestamptz, uuid);
-- and revert the route to the previous two-client write sequence. No data is
-- migrated, so dropping the function is the complete database rollback.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_table_inventory_atomic(
  p_table_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_maintenance_start timestamptz DEFAULT NULL,
  p_maintenance_end timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS public.table_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed constant text[] := ARRAY[
    'table_number', 'capacity', 'min_party_size', 'max_party_size', 'section', 'category',
    'seating_type', 'mobility', 'zone_id', 'active', 'status', 'position', 'notes'
  ];
  v_patch jsonb := COALESCE(p_patch, '{}'::jsonb);
  v_unknown text[];
  v_current public.table_inventory%ROWTYPE;
  v_next public.table_inventory%ROWTYPE;
BEGIN
  IF p_table_id IS NULL OR p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'table and restaurant are required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch must be an object' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(key ORDER BY key) INTO v_unknown
  FROM jsonb_object_keys(v_patch) AS key
  WHERE key <> ALL (v_allowed);
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'unsupported table fields: %', array_to_string(v_unknown, ', ')
      USING ERRCODE = '22023';
  END IF;

  IF (p_maintenance_start IS NULL) <> (p_maintenance_end IS NULL) THEN
    RAISE EXCEPTION 'maintenance window needs a start and an end' USING ERRCODE = '22023';
  END IF;
  IF p_maintenance_start IS NOT NULL THEN
    IF NOT isfinite(p_maintenance_start) OR NOT isfinite(p_maintenance_end)
       OR p_maintenance_start >= p_maintenance_end THEN
      RAISE EXCEPTION 'maintenance window must end after it starts' USING ERRCODE = '22023';
    END IF;
    IF v_patch->>'status' IS DISTINCT FROM 'out_of_service' THEN
      RAISE EXCEPTION 'maintenance window requires status out_of_service' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_current
  FROM public.table_inventory
  WHERE id = p_table_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'table_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_next := jsonb_populate_record(v_current, v_patch);

  IF v_next.zone_id IS DISTINCT FROM v_current.zone_id AND NOT EXISTS (
    SELECT 1 FROM public.zones WHERE id = v_next.zone_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'zone_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_patch <> '{}'::jsonb THEN
    UPDATE public.table_inventory
    SET table_number = v_next.table_number,
        capacity = v_next.capacity,
        min_party_size = v_next.min_party_size,
        max_party_size = v_next.max_party_size,
        section = v_next.section,
        category = v_next.category,
        seating_type = v_next.seating_type,
        mobility = v_next.mobility,
        zone_id = v_next.zone_id,
        active = v_next.active,
        status = v_next.status,
        position = v_next.position,
        notes = v_next.notes
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
    RETURNING * INTO v_next;
  ELSE
    v_next := v_current;
  END IF;

  IF v_patch ? 'status' THEN
    IF v_next.status = 'out_of_service' AND p_maintenance_start IS NOT NULL THEN
      DELETE FROM public.allocations
      WHERE restaurant_id = p_restaurant_id AND resource_type = 'table'
        AND resource_id = p_table_id AND is_maintenance;
      INSERT INTO public.allocations (
        booking_id, restaurant_id, resource_type, resource_id, "window", created_by, shadow, is_maintenance
      ) VALUES (
        NULL, p_restaurant_id, 'table', p_table_id,
        tstzrange(p_maintenance_start, p_maintenance_end, '[)'), p_actor_id, false, true
      );
    ELSIF v_next.status <> 'out_of_service' THEN
      DELETE FROM public.allocations
      WHERE restaurant_id = p_restaurant_id AND resource_type = 'table'
        AND resource_id = p_table_id AND is_maintenance;
    END IF;
  END IF;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.update_table_inventory_atomic(uuid, uuid, jsonb, timestamptz, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_table_inventory_atomic(uuid, uuid, jsonb, timestamptz, timestamptz, uuid)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
