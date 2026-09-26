-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
--
-- save_restaurant_availability replaces hours, service periods, turn bands and the booking-rule
-- fields in one transaction and returns the stored snapshot; create_booking_occasion and
-- delete_booking_occasion create, revive and remove a booking type atomically.
--
-- Run through `DB_TARGET_ENV=staging pnpm db:sql-regression`, which executes the synthetic
-- fixtures inside the same transaction and verifies the trailing ROLLBACK by comparing row
-- counts. Assertion failures raise SQLSTATE NB001, which no handler in this file catches
-- (the handlers below only catch the specific SQLSTATEs each step expects).
BEGIN;

DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_period_id constant uuid := '00000000-0000-4000-8000-0000000051a1';
  v_hours jsonb;
  v_narrow_hours jsonb;
  v_periods jsonb;
  v_bands jsonb;
  v_result jsonb;
  v_revision text;
  v_second_revision text;
  v_count integer;
  v_closes time;
  v_interval integer;
  v_policy text;
  v_state text;
  v_occasion jsonb;
  v_order integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_restaurant_id) THEN
    RAISE EXCEPTION 'synthetic fixture restaurant is missing; run through the sql-regression runner'
      USING ERRCODE = 'NB001';
  END IF;

  -- Monday 12:00-22:00, every other day closed.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'day_of_week', d,
      'effective_date', NULL,
      'opens_at', CASE WHEN d = 1 THEN '12:00' END,
      'closes_at', CASE WHEN d = 1 THEN '22:00' END,
      'is_closed', d <> 1,
      'notes', NULL,
      'reservation_interval_minutes', NULL,
      'reservation_slot_times', NULL
    )
  )
  INTO v_hours
  FROM generate_series(0, 6) AS d;

  v_periods := jsonb_build_array(
    jsonb_build_object(
      'id', v_period_id,
      'name', 'Lunch',
      'day_of_week', 1,
      'start_time', '12:00',
      'end_time', '15:00',
      'booking_option', 'lunch'
    )
  );
  v_bands := jsonb_build_array(
    jsonb_build_object(
      'restaurant_id', v_restaurant_id,
      'booking_option', 'lunch',
      'max_party_size', 4,
      'duration_minutes', 75
    )
  );

  -- 1. One command writes all four parts and returns the new revision.
  v_result := public.save_restaurant_availability(
    v_restaurant_id,
    v_hours,
    v_periods,
    v_bands,
    jsonb_build_object(
      'reservation_interval_minutes', 30,
      'reservation_default_duration_minutes', 105,
      'booking_policy', '  Arrive on time.  '
    ),
    NULL
  );
  v_revision := v_result ->> 'revision';
  IF v_revision IS NULL OR v_revision <> public.restaurant_availability_revision(v_restaurant_id) THEN
    RAISE EXCEPTION 'command did not return the stored revision' USING ERRCODE = 'NB001';
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.restaurant_operating_hours WHERE restaurant_id = v_restaurant_id;
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'expected 7 weekly rows, found %', v_count USING ERRCODE = 'NB001';
  END IF;
  SELECT reservation_interval_minutes, booking_policy INTO v_interval, v_policy
  FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_interval <> 30 OR v_policy <> 'Arrive on time.' THEN
    RAISE EXCEPTION 'rule fields not written (%, %)', v_interval, v_policy USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT reservation_default_duration_minutes FROM public.restaurants WHERE id = v_restaurant_id) <> 105 THEN
    RAISE EXCEPTION 'default duration not written' USING ERRCODE = 'NB001';
  END IF;

  -- 2. Atomicity: an invalid turn-band part rolls back the hours and rules changes sent with it.
  v_narrow_hours := (
    SELECT jsonb_agg(
      CASE WHEN (row ->> 'day_of_week')::integer = 1
        THEN row || jsonb_build_object('closes_at', '21:00')
        ELSE row
      END
    )
    FROM jsonb_array_elements(v_hours) AS row
  );
  BEGIN
    PERFORM public.save_restaurant_availability(
      v_restaurant_id,
      v_narrow_hours,
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'restaurant_id', v_restaurant_id,
          'booking_option', 'lunch',
          'max_party_size', 4,
          'duration_minutes', 75
        ),
        jsonb_build_object(
          'restaurant_id', v_restaurant_id,
          'booking_option', 'lunch',
          'max_party_size', 4,
          'duration_minutes', 90
        )
      ),
      jsonb_build_object('reservation_interval_minutes', 45),
      v_revision
    );
    RAISE EXCEPTION 'duplicate turn bands were accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN raise_exception THEN
    NULL; -- 'duplicate turn-band replacement row' from replace_restaurant_turn_bands
  END;
  SELECT closes_at INTO v_closes FROM public.restaurant_operating_hours
  WHERE restaurant_id = v_restaurant_id AND day_of_week = 1 AND effective_date IS NULL;
  IF v_closes <> '22:00'::time THEN
    RAISE EXCEPTION 'hours change survived a failed turn-band write' USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT reservation_interval_minutes FROM public.restaurants WHERE id = v_restaurant_id) <> 30 THEN
    RAISE EXCEPTION 'rules change survived a failed turn-band write' USING ERRCODE = 'NB001';
  END IF;
  IF public.restaurant_availability_revision(v_restaurant_id) <> v_revision THEN
    RAISE EXCEPTION 'revision moved after a rolled-back command' USING ERRCODE = 'NB001';
  END IF;

  -- 3. An unknown booking option (FK) also rolls back every part.
  BEGIN
    PERFORM public.save_restaurant_availability(
      v_restaurant_id,
      v_narrow_hours,
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'restaurant_id', v_restaurant_id,
          'booking_option', 'nb_no_such_option',
          'max_party_size', 2,
          'duration_minutes', 60
        )
      ),
      NULL,
      NULL
    );
    RAISE EXCEPTION 'unknown booking option was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  IF public.restaurant_availability_revision(v_restaurant_id) <> v_revision THEN
    RAISE EXCEPTION 'FK failure left a partial write' USING ERRCODE = 'NB001';
  END IF;

  -- 4. Meal times must sit inside the resulting hours: closing Monday at 14:00 with lunch to 15:00
  --    is refused, and nothing is written.
  BEGIN
    PERFORM public.save_restaurant_availability(
      v_restaurant_id,
      (
        SELECT jsonb_agg(
          CASE WHEN (row ->> 'day_of_week')::integer = 1
            THEN row || jsonb_build_object('closes_at', '14:00')
            ELSE row
          END
        )
        FROM jsonb_array_elements(v_hours) AS row
      ),
      NULL,
      NULL,
      NULL,
      v_revision
    );
    RAISE EXCEPTION 'meal time outside hours was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN SQLSTATE 'NT422' THEN
    NULL;
  END;
  IF public.restaurant_availability_revision(v_restaurant_id) <> v_revision THEN
    RAISE EXCEPTION 'out-of-hours failure left a partial write' USING ERRCODE = 'NB001';
  END IF;

  -- 5. Stale write: a caller holding an old revision cannot overwrite a newer save.
  v_result := public.save_restaurant_availability(
    v_restaurant_id, v_narrow_hours, NULL, NULL, NULL, v_revision
  );
  v_second_revision := v_result ->> 'revision';
  IF v_second_revision = v_revision THEN
    RAISE EXCEPTION 'revision did not change after a real change' USING ERRCODE = 'NB001';
  END IF;
  BEGIN
    PERFORM public.save_restaurant_availability(
      v_restaurant_id,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('reservation_interval_minutes', 60),
      v_revision
    );
    RAISE EXCEPTION 'stale write was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN SQLSTATE 'NT409' THEN
    NULL;
  END;
  IF (SELECT reservation_interval_minutes FROM public.restaurants WHERE id = v_restaurant_id) <> 30 THEN
    RAISE EXCEPTION 'stale write changed the rules' USING ERRCODE = 'NB001';
  END IF;

  -- 6. Replay: resending the save that already committed (old revision, same content) succeeds
  --    and changes nothing. New weekly row ids do not count as a change.
  v_result := public.save_restaurant_availability(
    v_restaurant_id,
    (
      SELECT jsonb_agg(row || jsonb_build_object('id', gen_random_uuid()))
      FROM jsonb_array_elements(v_narrow_hours) AS row
    ),
    NULL,
    NULL,
    NULL,
    v_revision
  );
  IF v_result ->> 'revision' <> v_second_revision THEN
    RAISE EXCEPTION 'replayed save was not treated as a no-op' USING ERRCODE = 'NB001';
  END IF;

  -- 7. Rules-only command leaves hours, periods and bands alone and only touches sent keys.
  PERFORM public.save_restaurant_availability(
    v_restaurant_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('reservation_lifecycle_grace_minutes', 20, 'booking_policy', ''),
    v_second_revision
  );
  SELECT reservation_interval_minutes, booking_policy INTO v_interval, v_policy
  FROM public.restaurants WHERE id = v_restaurant_id;
  IF v_interval <> 30 OR v_policy IS NOT NULL THEN
    RAISE EXCEPTION 'rules-only command wrote unexpected fields (%, %)', v_interval, v_policy
      USING ERRCODE = 'NB001';
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.restaurant_service_periods WHERE restaurant_id = v_restaurant_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'rules-only command changed service periods' USING ERRCODE = 'NB001';
  END IF;

  -- 8. Tenant isolation: a turn-band row for another restaurant is refused.
  BEGIN
    PERFORM public.save_restaurant_availability(
      v_restaurant_id,
      NULL,
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'restaurant_id', v_other_restaurant_id,
          'booking_option', 'lunch',
          'max_party_size', 2,
          'duration_minutes', 60
        )
      ),
      NULL,
      NULL
    );
    RAISE EXCEPTION 'cross-tenant turn band was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.restaurant_turn_bands WHERE restaurant_id = v_other_restaurant_id) THEN
    RAISE EXCEPTION 'cross-tenant turn band was written' USING ERRCODE = 'NB001';
  END IF;

  -- 9. Empty and missing-restaurant commands are refused.
  BEGIN
    PERFORM public.save_restaurant_availability(v_restaurant_id, NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'empty command was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN SQLSTATE 'NT400' THEN
    NULL;
  END;
  BEGIN
    PERFORM public.save_restaurant_availability(
      '00000000-0000-4000-8000-0000000000ff', NULL, NULL, NULL, '{}'::jsonb, NULL
    );
    RAISE EXCEPTION 'missing restaurant was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;

  -- 10. Only service_role may call the new functions.
  IF has_function_privilege('authenticated', 'public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.restaurant_availability_revision(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.create_booking_occasion(jsonb, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unexpected function grants' USING ERRCODE = 'NB001';
  END IF;

  -- 11. create_booking_occasion: create, refuse a duplicate, revive a soft-deleted key.
  v_occasion := public.create_booking_occasion(
    jsonb_build_object('key', 'nb_regression_type', 'label', 'Regression type'),
    NULL
  );
  IF v_occasion ->> 'key' <> 'nb_regression_type' OR (v_occasion ->> 'deleted_at') IS NOT NULL THEN
    RAISE EXCEPTION 'occasion was not created' USING ERRCODE = 'NB001';
  END IF;
  v_order := (v_occasion ->> 'display_order')::integer;
  BEGIN
    PERFORM public.create_booking_occasion(
      jsonb_build_object('key', 'nb_regression_type', 'label', 'Second attempt'),
      NULL
    );
    RAISE EXCEPTION 'duplicate occasion was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  IF (SELECT label FROM public.booking_occasions WHERE key = 'nb_regression_type') <> 'Regression type' THEN
    RAISE EXCEPTION 'duplicate create overwrote the first occasion' USING ERRCODE = 'NB001';
  END IF;
  -- A requested display_order already used by an active type is moved to the end.
  v_occasion := public.create_booking_occasion(
    jsonb_build_object('key', 'nb_regression_other', 'label', 'Other', 'display_order', v_order),
    NULL
  );
  IF (v_occasion ->> 'display_order')::integer = v_order THEN
    RAISE EXCEPTION 'colliding display_order was kept' USING ERRCODE = 'NB001';
  END IF;
  UPDATE public.booking_occasions
  SET deleted_at = now(), is_active = false
  WHERE key = 'nb_regression_type';
  v_occasion := public.create_booking_occasion(
    jsonb_build_object('key', 'nb_regression_type', 'label', 'Revived'),
    NULL
  );
  SELECT CASE WHEN deleted_at IS NULL AND is_active AND label = 'Revived' THEN 'ok' ELSE 'bad' END
  INTO v_state
  FROM public.booking_occasions WHERE key = 'nb_regression_type';
  IF v_state <> 'ok' THEN
    RAISE EXCEPTION 'soft-deleted occasion was not revived' USING ERRCODE = 'NB001';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.booking_occasions_audit
  WHERE occasion_key IN ('nb_regression_type', 'nb_regression_other') AND action = 'create';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'expected 3 create audit rows, found %', v_count USING ERRCODE = 'NB001';
  END IF;

  -- 12. The snapshot: the command returns the stored rows with the revision they hash to, read
  -- in the same transaction; the standalone read agrees, and a missing restaurant yields NULL.
  v_result := public.save_restaurant_availability(
    v_restaurant_id, NULL, NULL, NULL, jsonb_build_object('booking_policy', 'Snapshot policy'), NULL
  );
  IF v_result ->> 'revision' <> public.restaurant_availability_revision(v_restaurant_id)
    OR jsonb_array_length(v_result -> 'operating_hours') <> (
      SELECT COUNT(*) FROM public.restaurant_operating_hours WHERE restaurant_id = v_restaurant_id
    )
    OR jsonb_array_length(v_result -> 'service_periods') <> (
      SELECT COUNT(*) FROM public.restaurant_service_periods WHERE restaurant_id = v_restaurant_id
    )
    OR jsonb_array_length(v_result -> 'turn_bands') <> (
      SELECT COUNT(*) FROM public.restaurant_turn_bands WHERE restaurant_id = v_restaurant_id
    )
    OR v_result #>> '{restaurant,booking_policy}' <> 'Snapshot policy'
    OR (v_result #>> '{restaurant,timezone}') IS NULL THEN
    RAISE EXCEPTION 'command result is not the stored snapshot: %', v_result USING ERRCODE = 'NB001';
  END IF;
  IF public.restaurant_availability_snapshot(v_restaurant_id) <> v_result THEN
    RAISE EXCEPTION 'snapshot read differs from the command result' USING ERRCODE = 'NB001';
  END IF;
  IF public.restaurant_availability_snapshot('00000000-0000-4000-8000-00000000ffff') IS NOT NULL THEN
    RAISE EXCEPTION 'snapshot of a missing restaurant was not NULL' USING ERRCODE = 'NB001';
  END IF;

  -- 13. delete_booking_occasion: built-in refused, in use refused with counts, then removed with
  -- an audit row; a second removal is not_found; a meal time cannot use the removed type.
  v_occasion := public.delete_booking_occasion('lunch', NULL);
  IF v_occasion ->> 'status' <> 'builtin' THEN
    RAISE EXCEPTION 'built-in type removal: %', v_occasion USING ERRCODE = 'NB001';
  END IF;
  PERFORM public.replace_restaurant_service_periods(
    v_other_restaurant_id,
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(), 'name', 'Other', 'day_of_week', 2,
        'start_time', '18:00', 'end_time', '20:00', 'booking_option', 'nb_regression_other'
      )
    )
  );
  v_occasion := public.delete_booking_occasion('nb_regression_other', NULL);
  IF v_occasion ->> 'status' <> 'in_use' OR (v_occasion ->> 'service_periods')::integer <> 1 THEN
    RAISE EXCEPTION 'in-use type removal: %', v_occasion USING ERRCODE = 'NB001';
  END IF;
  IF (SELECT deleted_at FROM public.booking_occasions WHERE key = 'nb_regression_other') IS NOT NULL THEN
    RAISE EXCEPTION 'refused removal still soft-deleted the type' USING ERRCODE = 'NB001';
  END IF;
  PERFORM public.replace_restaurant_service_periods(v_other_restaurant_id, '[]'::jsonb);
  v_occasion := public.delete_booking_occasion('nb_regression_other', NULL);
  IF v_occasion ->> 'status' <> 'deleted' OR (v_occasion #>> '{after,deleted_at}') IS NULL THEN
    RAISE EXCEPTION 'unused type was not removed: %', v_occasion USING ERRCODE = 'NB001';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.booking_occasions_audit
  WHERE occasion_key = 'nb_regression_other' AND action = 'delete';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected 1 delete audit row, found %', v_count USING ERRCODE = 'NB001';
  END IF;
  IF public.delete_booking_occasion('nb_regression_other', NULL) ->> 'status' <> 'not_found' THEN
    RAISE EXCEPTION 'second removal was not not_found' USING ERRCODE = 'NB001';
  END IF;
  BEGIN
    PERFORM public.replace_restaurant_service_periods(
      v_other_restaurant_id,
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(), 'name', 'Other', 'day_of_week', 2,
          'start_time', '18:00', 'end_time', '20:00', 'booking_option', 'nb_regression_other'
        )
      )
    );
    RAISE EXCEPTION 'meal time with a removed type was accepted' USING ERRCODE = 'NB001';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  IF has_function_privilege('authenticated', 'public.delete_booking_occasion(text, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.restaurant_availability_snapshot(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.delete_booking_occasion(text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unexpected grants on the snapshot or delete functions' USING ERRCODE = 'NB001';
  END IF;

  RAISE NOTICE 'save-restaurant-availability regression PASSED';
END
$regression$;

ROLLBACK;
