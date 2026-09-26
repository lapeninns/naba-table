-- update_booking_with_capacity_check: stop returning Postgres error text.
--
-- Its WHEN OTHERS handler returns SQLERRM twice (top-level 'sqlerrm' and
-- details.sqlerrm). The RPC result reaches server/capacity/transaction.ts and from there
-- error details, so raw database text (constraint names, values) can reach clients and
-- logs. The handler's RAISE WARNING keeps SQLERRM in the database log for diagnosis.
--
-- The function body is not tracked in this repository (it predates the migration history
-- and exists only in the recovered 2026-02-08 staging baseline), so replacing it here could
-- silently revert changes made on production. Instead this migration renames the existing
-- function, whatever its body, to update_booking_with_capacity_check_unsanitized and puts a
-- wrapper with the identical signature, security and privileges in its place. The wrapper
-- calls the original and removes 'sqlerrm' from the result and from result.details.
-- SQLSTATE stays (it is a code, not text). Idempotent: rerunning replaces only the wrapper.
--
-- Rollout: staging first, then production (pnpm db:plan-remote). No data changes.
-- Rollback:
--   BEGIN;
--   DROP FUNCTION public.update_booking_with_capacity_check(uuid, uuid, uuid, date, time, time,
--     integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text);
--   ALTER FUNCTION public.update_booking_with_capacity_check_unsanitized(uuid, uuid, uuid, date,
--     time, time, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb,
--     integer, text) RENAME TO update_booking_with_capacity_check;
--   COMMIT;
BEGIN;

DO $rename$
BEGIN
  IF to_regprocedure('public.update_booking_with_capacity_check_unsanitized(uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text)') IS NULL THEN
    ALTER FUNCTION public.update_booking_with_capacity_check(
      uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text,
      text, text, text, text, text, boolean, uuid, text, jsonb, integer, text
    ) RENAME TO update_booking_with_capacity_check_unsanitized;
  END IF;
END;
$rename$;

REVOKE ALL ON FUNCTION public.update_booking_with_capacity_check_unsanitized(
  uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text,
  text, text, text, text, text, boolean, uuid, text, jsonb, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_with_capacity_check_unsanitized(
  uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text,
  text, text, text, text, text, boolean, uuid, text, jsonb, integer, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.update_booking_with_capacity_check(
  p_booking_id uuid,
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_booking_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_party_size integer,
  p_booking_type text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_seating_preference text,
  p_notes text DEFAULT NULL::text,
  p_marketing_opt_in boolean DEFAULT false,
  p_auth_user_id uuid DEFAULT NULL::uuid,
  p_client_request_id text DEFAULT NULL::text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_loyalty_points_awarded integer DEFAULT 0,
  p_source text DEFAULT 'api'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.update_booking_with_capacity_check_unsanitized(
    p_booking_id, p_restaurant_id, p_customer_id, p_booking_date, p_start_time, p_end_time,
    p_party_size, p_booking_type, p_customer_name, p_customer_email, p_customer_phone,
    p_seating_preference, p_notes, p_marketing_opt_in, p_auth_user_id, p_client_request_id,
    p_details, p_loyalty_points_awarded, p_source
  );

  IF v_result IS NULL OR jsonb_typeof(v_result) <> 'object' THEN
    RETURN v_result;
  END IF;

  v_result := v_result - 'sqlerrm';
  IF jsonb_typeof(v_result -> 'details') = 'object' THEN
    v_result := jsonb_set(v_result, '{details}', (v_result -> 'details') - 'sqlerrm');
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_with_capacity_check(
  uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text,
  text, text, text, text, text, boolean, uuid, text, jsonb, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_with_capacity_check(
  uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text,
  text, text, text, text, text, boolean, uuid, text, jsonb, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
