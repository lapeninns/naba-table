-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
-- 20260927250000 backfill: public.backfill_booking_owner_binding_v1 links an unlinked booking
-- to the single confirmed, non-anonymous auth user whose normalized email (trim + lower-case)
-- equals the booking's contact email, records each link in booking_owner_backfill_audit, and
-- is a no-op when re-run. It never links unconfirmed, anonymous or ambiguous users, never
-- changes an existing link and never matches an empty email. Runs scoped to restaurant A so
-- only fixture rows are touched.
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_customer_id constant uuid := '00000000-0000-4000-8000-00000000c001';
  -- Bookings.
  bk_match constant uuid := '00000000-0000-4000-8000-0000000fb101';
  bk_unconfirmed constant uuid := '00000000-0000-4000-8000-0000000fb102';
  bk_ambiguous constant uuid := '00000000-0000-4000-8000-0000000fb103';
  bk_already_bound constant uuid := '00000000-0000-4000-8000-0000000fb104';
  bk_empty constant uuid := '00000000-0000-4000-8000-0000000fb105';
  bk_anonymous constant uuid := '00000000-0000-4000-8000-0000000fb106';
  bk_confirmed_and_unconfirmed constant uuid := '00000000-0000-4000-8000-0000000fb107';
  -- Auth users.
  u_match constant uuid := '00000000-0000-4000-8000-0000000fa101';
  u_unconfirmed constant uuid := '00000000-0000-4000-8000-0000000fa102';
  u_twin_a constant uuid := '00000000-0000-4000-8000-0000000fa103';
  u_twin_b constant uuid := '00000000-0000-4000-8000-0000000fa104';
  u_prior_owner constant uuid := '00000000-0000-4000-8000-0000000fa105';
  u_empty constant uuid := '00000000-0000-4000-8000-0000000fa106';
  u_anonymous constant uuid := '00000000-0000-4000-8000-0000000fa107';
  u_mixed_confirmed constant uuid := '00000000-0000-4000-8000-0000000fa108';
  u_mixed_unconfirmed constant uuid := '00000000-0000-4000-8000-0000000fa109';
  v_linked integer;
  v_audit_count integer;
  v_first_backfilled_at timestamptz;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at, is_anonymous) VALUES
    (u_match, 'backfill-match@example.invalid', now(), false),
    (u_unconfirmed, 'backfill-unconfirmed@example.invalid', NULL, false),
    (u_twin_a, 'Backfill-Twin@example.invalid', now(), false),
    (u_twin_b, ' backfill-twin@example.invalid', now(), false),
    (u_prior_owner, 'backfill-prior-owner@example.invalid', now(), false),
    (u_empty, ' ', now(), false),
    (u_anonymous, 'backfill-anonymous@example.invalid', now(), true),
    (u_mixed_confirmed, 'backfill-mixed@example.invalid', now(), false),
    (u_mixed_unconfirmed, 'BACKFILL-MIXED@example.invalid', NULL, false);

  INSERT INTO public.bookings (
    id, restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
    party_size, status, customer_name, customer_email, customer_phone, reference, auth_user_id
  )
  SELECT
    v.id, v_restaurant_id, v_customer_id, DATE '2099-02-01', TIME '12:00', TIME '13:30',
    TIMESTAMPTZ '2099-02-01 12:00:00+00', TIMESTAMPTZ '2099-02-01 13:30:00+00',
    2, 'confirmed', 'Synthetic fixture', v.email, '+447000000011', v.reference, v.auth_user_id
  FROM (VALUES
    (bk_match, '  Backfill-MATCH@Example.invalid ', 'SYN-BACKFILL-1', NULL::uuid),
    (bk_unconfirmed, 'backfill-unconfirmed@example.invalid', 'SYN-BACKFILL-2', NULL::uuid),
    (bk_ambiguous, 'backfill-twin@example.invalid', 'SYN-BACKFILL-3', NULL::uuid),
    (bk_already_bound, 'backfill-match@example.invalid', 'SYN-BACKFILL-4', u_prior_owner),
    (bk_empty, '   ', 'SYN-BACKFILL-5', NULL::uuid),
    (bk_anonymous, 'backfill-anonymous@example.invalid', 'SYN-BACKFILL-6', NULL::uuid),
    (bk_confirmed_and_unconfirmed, 'backfill-mixed@example.invalid', 'SYN-BACKFILL-7', NULL::uuid)
  ) AS v(id, email, reference, auth_user_id);

  v_linked := public.backfill_booking_owner_binding_v1(v_restaurant_id);
  IF v_linked IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Expected 2 bookings linked, got %', v_linked USING ERRCODE = 'NB001';
  END IF;

  -- Confirmed unique match despite case and whitespace differences.
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_match) IS DISTINCT FROM u_match THEN
    RAISE EXCEPTION 'A confirmed unique email match was not linked' USING ERRCODE = 'NB001';
  END IF;
  -- One confirmed user plus an unconfirmed case variant is still a unique confirmed match.
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_confirmed_and_unconfirmed)
     IS DISTINCT FROM u_mixed_confirmed THEN
    RAISE EXCEPTION 'The single confirmed user among unconfirmed variants was not linked'
      USING ERRCODE = 'NB001';
  END IF;

  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_unconfirmed) IS NOT NULL THEN
    RAISE EXCEPTION 'An unconfirmed user was linked' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_ambiguous) IS NOT NULL THEN
    RAISE EXCEPTION 'An ambiguous email match was linked' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_already_bound) IS DISTINCT FROM u_prior_owner THEN
    RAISE EXCEPTION 'An existing owner link was changed' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_empty) IS NOT NULL THEN
    RAISE EXCEPTION 'A booking with an empty email was linked' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT auth_user_id FROM public.bookings WHERE id = bk_anonymous) IS NOT NULL THEN
    RAISE EXCEPTION 'An anonymous user was linked' USING ERRCODE = 'NB001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id IN ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b002')
      AND auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A fixture booking without a matching user was linked' USING ERRCODE = 'NB001';
  END IF;

  -- Audit rows record exactly the linked bookings and users.
  SELECT count(*) INTO v_audit_count
  FROM public.booking_owner_backfill_audit a
  WHERE a.booking_id IN (
    bk_match, bk_unconfirmed, bk_ambiguous, bk_already_bound, bk_empty, bk_anonymous,
    bk_confirmed_and_unconfirmed
  );
  IF v_audit_count <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.booking_owner_backfill_audit
       WHERE booking_id = bk_match AND auth_user_id = u_match
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.booking_owner_backfill_audit
       WHERE booking_id = bk_confirmed_and_unconfirmed AND auth_user_id = u_mixed_confirmed
     ) THEN
    RAISE EXCEPTION 'Audit rows do not match the linked bookings (count %)', v_audit_count
      USING ERRCODE = 'NB001';
  END IF;
  SELECT backfilled_at INTO v_first_backfilled_at
  FROM public.booking_owner_backfill_audit WHERE booking_id = bk_match;

  -- A second run is a no-op.
  v_linked := public.backfill_booking_owner_binding_v1(v_restaurant_id);
  IF v_linked IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'A second run linked % bookings', v_linked USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT count(*) FROM public.booking_owner_backfill_audit
      WHERE booking_id IN (bk_match, bk_confirmed_and_unconfirmed)) <> 2
     OR (SELECT backfilled_at FROM public.booking_owner_backfill_audit WHERE booking_id = bk_match)
        IS DISTINCT FROM v_first_backfilled_at THEN
    RAISE EXCEPTION 'A second run changed the audit rows' USING ERRCODE = 'NB001';
  END IF;

  -- Operator-only surface.
  IF has_function_privilege('anon', 'public.backfill_booking_owner_binding_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.backfill_booking_owner_binding_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.backfill_booking_owner_binding_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'The backfill function is executable by an API role' USING ERRCODE = 'NB001';
  END IF;
  IF has_table_privilege('anon', 'public.booking_owner_backfill_audit', 'SELECT')
     OR has_table_privilege('authenticated', 'public.booking_owner_backfill_audit', 'SELECT')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.booking_owner_backfill_audit'::regclass) THEN
    RAISE EXCEPTION 'The backfill audit table is readable by a client role or lacks RLS'
      USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'booking-owner-backfill regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'nabatable-regression: booking-owner-backfill FAILED (SQLSTATE %)', SQLSTATE;
    RAISE;
END;
$regression$;

ROLLBACK;
