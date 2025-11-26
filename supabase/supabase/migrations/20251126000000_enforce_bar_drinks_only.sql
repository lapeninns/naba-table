BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS bar_tables_drinks_only ON public.booking_table_assignments;
CREATE TRIGGER bar_tables_drinks_only
BEFORE INSERT OR UPDATE ON public.booking_table_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_bar_drinks_only();

COMMIT;
