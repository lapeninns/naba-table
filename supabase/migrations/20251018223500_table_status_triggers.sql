-- Migration: Table status automation via booking lifecycle triggers
-- Date: 2025-10-18

DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.refresh_table_status(p_table_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      v_has_checked_in boolean;
      v_has_future_or_current boolean;
    BEGIN
      IF p_table_id IS NULL THEN
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.allocations a
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND a.is_maintenance
          AND a."window" @> now()
      ) THEN
        UPDATE public.table_inventory
        SET status = 'out_of_service'
        WHERE id = p_table_id;
        RETURN;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.allocations a
        JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND b.status = 'checked_in'
          AND a."window" @> now()
      ) INTO v_has_checked_in;

      IF v_has_checked_in THEN
        UPDATE public.table_inventory
        SET status = 'occupied'
        WHERE id = p_table_id
          AND status <> 'out_of_service';
        RETURN;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.allocations a
        WHERE a.resource_type = 'table'
          AND a.resource_id = p_table_id
          AND upper(a."window") > now()
      ) INTO v_has_future_or_current;

      IF v_has_future_or_current THEN
        UPDATE public.table_inventory
        SET status = 'reserved'
        WHERE id = p_table_id
          AND status NOT IN ('occupied', 'out_of_service');
      ELSE
        UPDATE public.table_inventory
        SET status = 'available'
        WHERE id = p_table_id
          AND status <> 'out_of_service';
      END IF;
    END;
    $body$;
  $fn$;
END;
$$;

DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.on_booking_status_refresh()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      v_table_id uuid;
    BEGIN
      IF TG_OP <> 'UPDATE' OR NEW.status = OLD.status THEN
        RETURN NEW;
      END IF;

      FOR v_table_id IN
        SELECT table_id
        FROM public.booking_table_assignments
        WHERE booking_id = NEW.id
      LOOP
        PERFORM public.refresh_table_status(v_table_id);
      END LOOP;

      RETURN NEW;
    END;
    $body$;
  $fn$;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_status_refresh ON public.bookings;
CREATE TRIGGER trg_booking_status_refresh
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.on_booking_status_refresh();

DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.on_allocations_refresh()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      v_table uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(OLD.resource_id);
        END IF;
      ELSE
        IF NEW.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(NEW.resource_id);
        END IF;
      END IF;
      RETURN NULL;
    END;
    $body$;
  $fn$;
END;
$$;

DROP TRIGGER IF EXISTS trg_allocations_refresh ON public.allocations;
CREATE TRIGGER trg_allocations_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.on_allocations_refresh();
