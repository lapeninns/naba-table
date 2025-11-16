-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Create table to track hold windows per table
CREATE TABLE IF NOT EXISTS public.table_hold_windows (
  hold_id uuid NOT NULL,
  table_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  booking_id uuid,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  hold_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
  CONSTRAINT table_hold_windows_pkey PRIMARY KEY (hold_id, table_id)
);
ALTER TABLE public.table_hold_windows
  ADD CONSTRAINT table_hold_windows_hold_id_fkey
  FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;
ALTER TABLE public.table_hold_windows
  ADD CONSTRAINT table_hold_windows_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS table_hold_windows_table_idx
  ON public.table_hold_windows (table_id);
CREATE INDEX IF NOT EXISTS table_hold_windows_restaurant_idx
  ON public.table_hold_windows (restaurant_id);
ALTER TABLE public.table_hold_windows
  ADD CONSTRAINT table_hold_windows_no_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    hold_window WITH &&
  );
CREATE OR REPLACE FUNCTION public.is_holds_strict_conflicts_enabled()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  setting text;
BEGIN
  BEGIN
    setting := current_setting('app.holds.strict_conflicts.enabled', true);
  EXCEPTION
    WHEN others THEN
      setting := NULL;
  END;

  IF setting IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN lower(setting) IN ('1', 't', 'true', 'on', 'enabled');
END;
$$;
CREATE OR REPLACE FUNCTION public.set_hold_conflict_enforcement(enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'app.holds.strict_conflicts.enabled',
    CASE WHEN enabled THEN 'on' ELSE 'off' END,
    true
  );
  RETURN enabled;
END;
$$;
-- Trigger helpers to keep table in sync
CREATE OR REPLACE FUNCTION public.sync_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;
    RETURN OLD;
  END IF;

  IF NOT public.is_holds_strict_conflicts_enabled() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
    SELECT NEW.hold_id, NEW.table_id, h.restaurant_id, h.booking_id, h.start_at, h.end_at, h.expires_at
    FROM public.table_holds h
    WHERE h.id = NEW.hold_id
    ON CONFLICT (hold_id, table_id) DO UPDATE
      SET start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          expires_at = EXCLUDED.expires_at,
          restaurant_id = EXCLUDED.restaurant_id,
          booking_id = EXCLUDED.booking_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_holds_strict_conflicts_enabled() THEN
    RETURN NEW;
  END IF;

  UPDATE public.table_hold_windows
  SET start_at = NEW.start_at,
      end_at = NEW.end_at,
      expires_at = NEW.expires_at,
      restaurant_id = NEW.restaurant_id,
      booking_id = NEW.booking_id
  WHERE hold_id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS table_hold_members_sync_insert ON public.table_hold_members;
DROP TRIGGER IF EXISTS table_hold_members_sync_delete ON public.table_hold_members;
DROP TRIGGER IF EXISTS table_holds_sync_update ON public.table_holds;
CREATE TRIGGER table_hold_members_sync_insert
AFTER INSERT ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();
CREATE TRIGGER table_hold_members_sync_delete
AFTER DELETE ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();
CREATE TRIGGER table_holds_sync_update
AFTER UPDATE OF start_at, end_at, expires_at, restaurant_id, booking_id ON public.table_holds
FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();
-- SQL helper to evaluate availability in the database
CREATE OR REPLACE FUNCTION public.is_table_available_v2(
  p_table_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.table_id = p_table_id
    AND tstzrange(bta.start_at, bta.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND b.status IN ('pending', 'confirmed', 'checked_in')
);
$$;
