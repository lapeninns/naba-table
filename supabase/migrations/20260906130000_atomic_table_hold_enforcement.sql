-- Restore strict hold invariants from authoritative hold/member rows. No session
-- settings or asynchronous sweep are part of admission. Existing live conflicts
-- stop this migration; no booking or hold is silently selected as the winner.
LOCK TABLE public.table_holds, public.table_hold_members, public.table_hold_windows,
  public.booking_table_assignments, public.allocations, public.table_inventory IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.table_holds h
    LEFT JOIN public.zones z ON z.id=h.zone_id
    LEFT JOIN public.bookings b ON b.id=h.booking_id
    WHERE z.restaurant_id IS DISTINCT FROM h.restaurant_id
       OR (h.booking_id IS NOT NULL AND b.restaurant_id IS DISTINCT FROM h.restaurant_id)
  ) OR EXISTS (
    SELECT 1 FROM public.table_hold_members m JOIN public.table_holds h ON h.id=m.hold_id
    JOIN public.table_inventory t ON t.id=m.table_id
    WHERE t.restaurant_id IS DISTINCT FROM h.restaurant_id OR t.zone_id IS DISTINCT FROM h.zone_id
  ) THEN
    RAISE EXCEPTION 'Hold migration preflight: incoherent tenant references' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
    JOIN public.table_hold_members n ON n.table_id=m.table_id AND n.hold_id<>h.id
    JOIN public.table_holds other ON other.id=n.hold_id
    WHERE h.status='active' AND other.status='active'
      AND h.expires_at>clock_timestamp() AND other.expires_at>clock_timestamp()
      AND tstzrange(h.start_at,h.end_at,'[)') && tstzrange(other.start_at,other.end_at,'[)')
  ) THEN
    RAISE EXCEPTION 'Hold migration preflight: overlapping live holds' USING ERRCODE='23P01';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
    JOIN public.booking_table_assignments a ON a.table_id=m.table_id
    JOIN public.bookings b ON b.id=a.booking_id
    WHERE h.status='active' AND h.expires_at>clock_timestamp()
      AND a.booking_id IS DISTINCT FROM h.booking_id AND b.status NOT IN ('cancelled','completed','no_show')
      AND tstzrange(h.start_at,h.end_at,'[)') && tstzrange(a.start_at,a.end_at,'[)')
  ) OR EXISTS (
    SELECT 1 FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
    JOIN public.allocations a ON a.resource_type='table' AND a.resource_id=m.table_id
    WHERE h.status='active' AND h.expires_at>clock_timestamp()
      AND (h.booking_id IS NULL OR a.booking_id IS DISTINCT FROM h.booking_id)
      AND a."window" && tstzrange(h.start_at,h.end_at,'[)')
      AND (a.booking_id IS NULL OR a.is_maintenance OR EXISTS (SELECT 1 FROM public.bookings b
        WHERE b.id=a.booking_id AND b.status NOT IN ('cancelled','completed','no_show')))
  ) OR EXISTS (
    SELECT 1 FROM public.table_holds h WHERE h.status='active' AND h.expires_at>clock_timestamp()
      AND NOT EXISTS (SELECT 1 FROM public.table_hold_members m WHERE m.hold_id=h.id)
  ) THEN
    RAISE EXCEPTION 'Hold migration preflight: live assignment conflict or orphan hold' USING ERRCODE='23514';
  END IF;
END;
$preflight$;

-- Called only by SECURITY DEFINER triggers/RPC. Competing hold rows are read,
-- never locked after inventory: admission is serialized on inventory itself.
CREATE OR REPLACE FUNCTION public.validate_table_hold_state(
  p_hold_id uuid, p_booking_id uuid, p_restaurant_id uuid, p_zone_id uuid,
  p_table_ids uuid[], p_start_at timestamptz, p_end_at timestamptz,
  p_expires_at timestamptz, p_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_count integer;
  v_now timestamptz;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Hold admission requires READ COMMITTED isolation' USING ERRCODE='25001';
  END IF;
  IF p_restaurant_id IS NULL OR p_zone_id IS NULL OR p_start_at IS NULL OR p_end_at IS NULL
     OR NOT isfinite(p_start_at) OR NOT isfinite(p_end_at) OR p_start_at>=p_end_at
     OR p_expires_at IS NULL OR NOT isfinite(p_expires_at) THEN
    RAISE EXCEPTION 'Invalid hold window' USING ERRCODE='23514';
  END IF;
  IF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id;
    IF NOT FOUND OR v_booking.restaurant_id<>p_restaurant_id THEN
      RAISE EXCEPTION 'Hold booking tenant mismatch' USING ERRCODE='42501';
    END IF;
    IF p_active AND p_expires_at>clock_timestamp()
       AND v_booking.status IN ('cancelled','completed','no_show') THEN
      RAISE EXCEPTION 'Terminal booking cannot acquire a hold' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zones WHERE id=p_zone_id AND restaurant_id=p_restaurant_id) THEN
    RAISE EXCEPTION 'Hold zone tenant mismatch' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.table_inventory WHERE id=ANY(p_table_ids) AND restaurant_id=p_restaurant_id ORDER BY id FOR UPDATE;
  SELECT count(DISTINCT id) INTO v_count FROM public.table_inventory
  WHERE id=ANY(p_table_ids) AND restaurant_id=p_restaurant_id;
  IF v_count<>COALESCE(cardinality(p_table_ids),0) OR array_position(p_table_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Hold table tenant mismatch or duplicate table' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.table_inventory WHERE id=ANY(p_table_ids) AND zone_id IS DISTINCT FROM p_zone_id) THEN
    RAISE EXCEPTION 'Hold tables must belong to the selected zone' USING ERRCODE='23514';
  END IF;
  v_now:=clock_timestamp();
  IF NOT p_active OR p_expires_at<=v_now THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.table_inventory WHERE id=ANY(p_table_ids) AND (status='out_of_service' OR active=false))
     OR EXISTS (SELECT 1 FROM public.zones WHERE id=p_zone_id AND active=false) THEN
    RAISE EXCEPTION 'Disabled or out-of-service table cannot acquire a hold' USING ERRCODE='23514';
  END IF;
  IF p_expires_at>v_now+interval '600 seconds' THEN
    RAISE EXCEPTION 'Hold TTL exceeds 600 seconds' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
    WHERE m.table_id=ANY(p_table_ids) AND h.id IS DISTINCT FROM p_hold_id
      AND h.status='active' AND h.expires_at>v_now
      AND tstzrange(h.start_at,h.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) OR EXISTS (
    SELECT 1 FROM public.booking_table_assignments a JOIN public.bookings b ON b.id=a.booking_id
    WHERE a.table_id=ANY(p_table_ids) AND a.booking_id IS DISTINCT FROM p_booking_id
      AND b.status NOT IN ('cancelled','completed','no_show')
      AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) OR EXISTS (
    SELECT 1 FROM public.allocations a
    WHERE a.resource_type='table' AND a.resource_id=ANY(p_table_ids)
      AND (p_booking_id IS NULL OR a.booking_id IS DISTINCT FROM p_booking_id)
      AND a."window" && tstzrange(p_start_at,p_end_at,'[)')
      AND (a.booking_id IS NULL OR a.is_maintenance OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=a.booking_id
           AND b.status NOT IN ('cancelled','completed','no_show')))
  ) THEN
    RAISE EXCEPTION 'Existing hold or assignment conflicts with requested tables' USING ERRCODE='23P01';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_table_hold_header()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tables uuid[];
BEGIN
  IF TG_OP='INSERT' AND NEW.booking_id IS NOT NULL THEN
    PERFORM id FROM public.bookings WHERE id=NEW.booking_id FOR UPDATE;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.restaurant_id<>OLD.restaurant_id
      OR NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.created_at<>OLD.created_at) THEN
    RAISE EXCEPTION 'Hold identity is immutable' USING ERRCODE='23514';
  END IF;
  SELECT array_agg(table_id ORDER BY table_id) INTO v_tables FROM public.table_hold_members WHERE hold_id=NEW.id;
  PERFORM public.validate_table_hold_state(NEW.id,NEW.booking_id,NEW.restaurant_id,NEW.zone_id,
    v_tables,NEW.start_at,NEW.end_at,NEW.expires_at,NEW.status='active');
  IF TG_OP='INSERT' AND (NEW.status<>'active' OR NEW.expires_at<=clock_timestamp()) THEN
    RAISE EXCEPTION 'New hold must be active with a future expiry' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_table_hold_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.table_holds%ROWTYPE; v_tables uuid[];
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Hold member mutation requires READ COMMITTED isolation' USING ERRCODE='25001';
  END IF;
  IF TG_OP='UPDATE' THEN
    RAISE EXCEPTION 'Hold members are immutable; replace under the parent lock in one transaction' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN
    PERFORM id FROM public.table_holds WHERE id=OLD.hold_id FOR UPDATE;
    RETURN OLD; -- Parent can already be absent during its FK cascade.
  END IF;
  -- Serialize changes to this header before checking the complete member set.
  SELECT * INTO h FROM public.table_holds WHERE id=NEW.hold_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hold not found' USING ERRCODE='23503'; END IF;
  SELECT array_agg(DISTINCT t ORDER BY t) INTO v_tables FROM (
    SELECT table_id AS t FROM public.table_hold_members WHERE hold_id=h.id
      AND (TG_OP<>'UPDATE' OR id<>NEW.id)
    UNION SELECT NEW.table_id
  ) x;
  PERFORM public.validate_table_hold_state(h.id,h.booking_id,h.restaurant_id,h.zone_id,
    v_tables,h.start_at,h.end_at,h.expires_at,h.status='active');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_strict_table_hold_projection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hold_id uuid;
BEGIN
  IF TG_TABLE_NAME='table_holds' THEN v_hold_id:=NEW.id;
  ELSE v_hold_id:=CASE WHEN TG_OP='DELETE' THEN OLD.hold_id ELSE NEW.hold_id END; END IF;
  DELETE FROM public.table_hold_windows WHERE hold_id=v_hold_id;
  INSERT INTO public.table_hold_windows(hold_id,table_id,restaurant_id,booking_id,start_at,end_at,expires_at)
  SELECT h.id,m.table_id,h.restaurant_id,h.booking_id,h.start_at,h.end_at,h.expires_at
  FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
  WHERE h.id=v_hold_id AND h.status='active';
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_table_hold_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hold_id uuid;
BEGIN
  IF TG_TABLE_NAME='table_holds' THEN v_hold_id:=NEW.id;
  ELSE v_hold_id:=OLD.hold_id; END IF;
  IF EXISTS (SELECT 1 FROM public.table_holds h WHERE h.id=v_hold_id AND h.status='active'
      AND h.expires_at>clock_timestamp() AND NOT EXISTS (
        SELECT 1 FROM public.table_hold_members m WHERE m.hold_id=h.id)) THEN
    RAISE EXCEPTION 'Active hold requires table members in the same transaction' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER strict_hold_header_guard BEFORE INSERT OR UPDATE ON public.table_holds
FOR EACH ROW EXECUTE FUNCTION public.guard_table_hold_header();
CREATE TRIGGER strict_hold_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.guard_table_hold_member();
CREATE TRIGGER strict_hold_header_projection AFTER INSERT OR UPDATE ON public.table_holds
FOR EACH ROW EXECUTE FUNCTION public.sync_strict_table_hold_projection();
CREATE TRIGGER strict_hold_member_projection AFTER INSERT OR UPDATE OR DELETE ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.sync_strict_table_hold_projection();
CREATE CONSTRAINT TRIGGER strict_hold_requires_members AFTER INSERT OR UPDATE ON public.table_holds
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_table_hold_members();
CREATE CONSTRAINT TRIGGER strict_hold_member_delete_requires_members AFTER DELETE ON public.table_hold_members
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_table_hold_members();

CREATE OR REPLACE FUNCTION public.create_table_hold_atomic(
  p_booking_id uuid,p_restaurant_id uuid,p_zone_id uuid,p_table_ids uuid[],
  p_start_at timestamptz,p_end_at timestamptz,p_expires_at timestamptz,
  p_created_by uuid DEFAULT NULL,p_metadata jsonb DEFAULT NULL
) RETURNS SETOF public.table_holds LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid:=gen_random_uuid(); v_tables uuid[];
BEGIN
  IF p_table_ids IS NULL OR cardinality(p_table_ids)=0 OR array_position(p_table_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'At least one valid hold table is required' USING ERRCODE='23514';
  END IF;
  IF p_booking_id IS NOT NULL THEN
    PERFORM id FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  END IF;
  SELECT array_agg(DISTINCT t ORDER BY t) INTO v_tables FROM unnest(p_table_ids) t;
  PERFORM public.validate_table_hold_state(v_id,p_booking_id,p_restaurant_id,p_zone_id,v_tables,
    p_start_at,p_end_at,p_expires_at,true);
  IF p_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'Hold expiry elapsed while waiting for inventory' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.table_holds(id,booking_id,restaurant_id,zone_id,start_at,end_at,expires_at,created_by,metadata)
  VALUES(v_id,p_booking_id,p_restaurant_id,p_zone_id,p_start_at,p_end_at,p_expires_at,p_created_by,p_metadata);
  INSERT INTO public.table_hold_members(hold_id,table_id) SELECT v_id,t FROM unnest(v_tables) t ORDER BY t;
  RETURN QUERY SELECT * FROM public.table_holds WHERE id=v_id;
END;
$$;

-- Reverse direction: an assignment must not take another booking's live hold.
CREATE OR REPLACE FUNCTION public.guard_assignment_against_table_holds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_restaurant uuid; v_now timestamptz; v_table uuid; v_booking uuid; v_window tstzrange;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Assignment admission requires READ COMMITTED isolation' USING ERRCODE='25001';
  END IF;
  IF TG_TABLE_NAME='allocations' THEN
    IF NEW.resource_type<>'table' THEN RETURN NEW; END IF;
    v_booking:=NEW.booking_id; v_table:=NEW.resource_id; v_restaurant:=NEW.restaurant_id; v_window:=NEW."window";
  ELSE
    v_booking:=NEW.booking_id; v_table:=NEW.table_id; v_window:=tstzrange(NEW.start_at,NEW.end_at,'[)');
  END IF;
  IF v_booking IS NOT NULL THEN
    IF TG_OP='INSERT' THEN
      SELECT restaurant_id INTO v_restaurant FROM public.bookings WHERE id=v_booking FOR UPDATE;
    ELSE
      SELECT restaurant_id INTO v_restaurant FROM public.bookings WHERE id=v_booking;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment booking not found' USING ERRCODE='23503'; END IF;
    IF TG_TABLE_NAME='allocations' THEN
      IF NEW.restaurant_id<>v_restaurant THEN
        RAISE EXCEPTION 'Allocation booking tenant mismatch' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  PERFORM id FROM public.table_inventory WHERE id=v_table AND restaurant_id=v_restaurant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment table tenant mismatch' USING ERRCODE='42501'; END IF;
  v_now:=clock_timestamp();
  IF EXISTS (SELECT 1 FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id
      WHERE m.table_id=v_table AND (v_booking IS NULL OR h.booking_id IS DISTINCT FROM v_booking)
        AND h.status='active' AND h.expires_at>v_now
        AND tstzrange(h.start_at,h.end_at,'[)') && v_window) THEN
    RAISE EXCEPTION 'Assignment conflicts with an active table hold' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER strict_assignment_hold_guard BEFORE INSERT OR UPDATE ON public.booking_table_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_against_table_holds();
CREATE TRIGGER strict_allocation_hold_guard BEFORE INSERT OR UPDATE ON public.allocations
FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_against_table_holds();

-- Projection is derived state; repair it only after the live-data preflight passed.
DELETE FROM public.table_hold_windows;
INSERT INTO public.table_hold_windows(hold_id,table_id,restaurant_id,booking_id,start_at,end_at,expires_at)
SELECT h.id,m.table_id,h.restaurant_id,h.booking_id,h.start_at,h.end_at,h.expires_at
FROM public.table_holds h JOIN public.table_hold_members m ON m.hold_id=h.id WHERE h.status='active';

CREATE OR REPLACE FUNCTION public.guard_table_hold_projection_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Table hold windows are maintained by canonical hold triggers' USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER strict_hold_projection_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.table_hold_windows
FOR EACH ROW EXECUTE FUNCTION public.guard_table_hold_projection_write();

CREATE OR REPLACE FUNCTION public.release_booking_table_state(
  p_booking_id uuid,
  p_restaurant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_table_ids uuid[];
  removed_count integer := 0;
  target_table_id uuid;
BEGIN
  PERFORM booking.id FROM public.bookings AS booking
  WHERE booking.id = p_booking_id AND booking.restaurant_id = p_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for restaurant-scoped table release'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT table_id ORDER BY table_id)
  INTO affected_table_ids
  FROM (
    SELECT assignment.table_id
    FROM public.booking_table_assignments AS assignment
    WHERE assignment.booking_id = p_booking_id
    UNION
    SELECT allocation.resource_id
    FROM public.allocations AS allocation
    WHERE allocation.booking_id = p_booking_id
      AND allocation.restaurant_id = p_restaurant_id
      AND allocation.resource_type = 'table'
  ) AS affected;

  DELETE FROM public.table_holds WHERE booking_id=p_booking_id AND restaurant_id=p_restaurant_id;

  PERFORM public.archive_booking_allocations(p_booking_id, p_restaurant_id);

  DELETE FROM public.booking_table_assignments AS assignment
  WHERE assignment.booking_id = p_booking_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.id = assignment.booking_id
        AND booking.restaurant_id = p_restaurant_id
    );

  GET DIAGNOSTICS removed_count = ROW_COUNT;

  DELETE FROM public.booking_assignment_idempotency AS idempotency
  WHERE idempotency.booking_id = p_booking_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.id = idempotency.booking_id
        AND booking.restaurant_id = p_restaurant_id
    );

  UPDATE public.bookings AS booking
  SET assigned_zone_id = NULL
  WHERE booking.id = p_booking_id
    AND booking.restaurant_id = p_restaurant_id
    AND booking.assigned_zone_id IS NOT NULL;

  FOR target_table_id IN
    SELECT inventory.id
    FROM public.table_inventory AS inventory
    WHERE inventory.restaurant_id = p_restaurant_id
      AND inventory.id = ANY(COALESCE(affected_table_ids, ARRAY[]::uuid[]))
    ORDER BY inventory.id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.refresh_table_status(target_table_id);
  END LOOP;

  RETURN removed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_holds_strict_conflicts_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $$
  SELECT count(*)=9 FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled='O' AND (
    (t.tgrelid='public.table_holds'::regclass AND t.tgname IN ('strict_hold_header_guard','strict_hold_header_projection','strict_hold_requires_members'))
    OR (t.tgrelid='public.table_hold_members'::regclass AND t.tgname IN ('strict_hold_member_guard','strict_hold_member_projection','strict_hold_member_delete_requires_members'))
    OR (t.tgrelid='public.table_hold_windows'::regclass AND t.tgname='strict_hold_projection_write_guard')
    OR (t.tgrelid='public.allocations'::regclass AND t.tgname='strict_allocation_hold_guard')
    OR (t.tgrelid='public.booking_table_assignments'::regclass AND t.tgname='strict_assignment_hold_guard')
  );
$$;
CREATE OR REPLACE FUNCTION public.set_hold_conflict_enforcement(enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Strict hold enforcement cannot be disabled' USING ERRCODE='42501';
  END IF;
  RETURN public.is_holds_strict_conflicts_enabled();
END;
$$;
REVOKE ALL ON FUNCTION public.validate_table_hold_state(uuid,uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_table_hold_header() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_table_hold_member() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_strict_table_hold_projection() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.require_table_hold_members() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_assignment_against_table_holds() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_table_hold_projection_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_booking_table_state(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_table_hold_atomic(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_holds_strict_conflicts_enabled() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_hold_conflict_enforcement(boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_table_hold_atomic(uuid,uuid,uuid,uuid[],timestamptz,timestamptz,timestamptz,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_holds_strict_conflicts_enabled() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_hold_conflict_enforcement(boolean) TO service_role;

-- Preserve canonical confirmation behavior; order locks before cancellation can delete the hold.
CREATE OR REPLACE FUNCTION public.confirm_hold_assignment_tx(p_hold_id uuid, p_booking_id uuid, p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_window_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_policy_version text DEFAULT NULL::text, p_expected_adjacency_hash text DEFAULT NULL::text, p_target_status booking_status DEFAULT NULL::booking_status, p_history_reason text DEFAULT 'auto_assign_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb, p_history_changed_by uuid DEFAULT NULL::uuid)
 RETURNS TABLE(assignment_id uuid, table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_zone_id uuid;
  v_policy_version text;
  v_snapshot_hash text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_rows integer;
  v_booking_status public.booking_status;
  v_payload_checksum text;
  v_dedupe_key text;
  v_table_list text;
  v_hold_payload jsonb;
BEGIN
  IF p_window_start IS NULL AND p_window_end IS NOT NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_start IS NOT NULL AND p_window_end IS NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  -- Global order: booking before hold, matching terminal cancellation.
  PERFORM id FROM public.bookings WHERE id=p_booking_id FOR UPDATE;

  SELECT * INTO v_hold
  FROM public.table_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.booking_id IS NOT NULL AND v_hold.booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Hold % belongs to booking % (expected %)', p_hold_id, v_hold.booking_id, p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  v_now := clock_timestamp();
  IF v_hold.expires_at <= v_now THEN
    RAISE EXCEPTION 'Hold % expired at %', p_hold_id, v_hold.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(thm.table_id ORDER BY thm.table_id)
  INTO v_table_ids
  FROM public.table_hold_members thm
  WHERE thm.hold_id = p_hold_id;

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Hold % has no table members', p_hold_id
      USING ERRCODE = 'P0001';
  END IF;

  v_zone_id := v_hold.zone_id;
  v_policy_version := COALESCE((v_hold.metadata ->> 'policyVersion'), NULL);
  v_snapshot_hash := v_hold.metadata -> 'selection' -> 'snapshot' -> 'adjacency' ->> 'hash';

  IF p_expected_policy_version IS NOT NULL AND v_policy_version IS NOT NULL AND v_policy_version <> p_expected_policy_version THEN
    RAISE EXCEPTION 'Policy version changed (hold %, expected %, actual %)', p_hold_id, p_expected_policy_version, v_policy_version
      USING ERRCODE = 'P0003';
  END IF;

  IF p_expected_adjacency_hash IS NOT NULL AND v_snapshot_hash IS NOT NULL AND v_snapshot_hash <> p_expected_adjacency_hash THEN
    RAISE EXCEPTION 'Adjacency snapshot changed for hold %', p_hold_id
      USING ERRCODE = 'P0003';
  END IF;

  v_start_at := COALESCE(p_window_start, v_hold.start_at);
  v_end_at := COALESCE(p_window_end, v_hold.end_at);

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RAISE EXCEPTION 'Hold % missing scheduling window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Hold % has invalid window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');

  DROP TABLE IF EXISTS tmp_confirm_assignments_tx;
  CREATE TEMP TABLE tmp_confirm_assignments_tx ON COMMIT DROP AS
    SELECT *
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      v_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      v_start_at,
      v_end_at
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF p_target_status IS NOT NULL THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found during transition', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_booking_status <> p_target_status THEN
      PERFORM public.apply_booking_state_transition(
        p_booking_id,
        p_target_status,
        NULL,
        NULL,
        v_now,
        v_booking_status,
        p_target_status,
        p_history_changed_by,
        v_now,
        COALESCE(p_history_reason, 'auto_assign_confirm'),
        COALESCE(p_history_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_payload_checksum := encode(
      digest(
        jsonb_build_object(
          'bookingId', p_booking_id,
          'tableIds', v_table_ids,
          'startAt', v_start_at,
          'endAt', v_end_at,
          'actorId', p_assigned_by,
          'holdId', p_hold_id
        )::text,
        'sha256'
      ),
      'hex'
    );

    UPDATE public.booking_assignment_idempotency
      SET payload_checksum = v_payload_checksum
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  v_table_list := array_to_string(v_table_ids, ',');
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), v_table_list);

  BEGIN
    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.assignment.sync',
      v_dedupe_key,
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      jsonb_build_object(
        'bookingId', p_booking_id,
        'restaurantId', v_hold.restaurant_id,
        'tableIds', v_table_ids,
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'mergeGroupId', (SELECT tmp.merge_group_id FROM tmp_confirm_assignments_tx tmp LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    v_hold_payload := jsonb_build_object(
      'holdId', p_hold_id,
      'bookingId', p_booking_id,
      'restaurantId', v_hold.restaurant_id,
      'zoneId', v_zone_id,
      'tableIds', v_table_ids,
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_assigned_by,
      'metadata', v_hold.metadata
    );

    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.hold.confirmed',
      format('%s:%s:hold.confirmed', p_booking_id, p_hold_id),
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      v_hold_payload
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.booking_confirmation_results (
        booking_id,
        hold_id,
        restaurant_id,
        idempotency_key,
        table_ids,
        assignment_window,
        actor_id,
        metadata
      ) VALUES (
        p_booking_id,
        p_hold_id,
        v_hold.restaurant_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        p_assigned_by,
        v_hold.metadata
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            restaurant_id = EXCLUDED.restaurant_id,
            hold_id = EXCLUDED.hold_id,
            actor_id = EXCLUDED.actor_id,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  DELETE FROM public.table_holds WHERE id = p_hold_id;

  RETURN QUERY
    SELECT bta.id,
           tmp.table_id,
           tmp.start_at,
           tmp.end_at,
           tmp.merge_group_id
    FROM tmp_confirm_assignments_tx tmp
    JOIN public.booking_table_assignments bta
      ON bta.booking_id = p_booking_id
     AND bta.table_id = tmp.table_id;
END;
$function$
;
