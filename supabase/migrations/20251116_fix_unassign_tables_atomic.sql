DO $migration$
BEGIN
  EXECUTE $create$
    CREATE OR REPLACE FUNCTION public.unassign_tables_atomic(
      p_booking_id uuid,
      p_table_ids uuid[] DEFAULT NULL
    ) RETURNS TABLE(table_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $function$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT t.table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      ELSE
        SELECT array_agg(bta.table_id)
        INTO v_target_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = ANY (v_target_tables)
        RETURNING bta.table_id
      LOOP
        unassign_tables_atomic.table_id := v_removed.table_id;

        DELETE FROM public.allocations alloc
        WHERE alloc.booking_id = p_booking_id
          AND alloc.resource_type = 'table'
          AND alloc.resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta2
            WHERE bta2.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      RETURN;
    END;
    $function$
  $create$;

  EXECUTE $owner$
    ALTER FUNCTION public.unassign_tables_atomic(uuid, uuid[]) OWNER TO postgres
  $owner$;

  EXECUTE $grant$
    GRANT ALL ON FUNCTION public.unassign_tables_atomic(uuid, uuid[]) TO service_role
  $grant$;
END;
$migration$;
