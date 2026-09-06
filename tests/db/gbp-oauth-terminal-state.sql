-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_other_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a002';
  v_user_id constant uuid := '00000000-0000-4000-8000-00000000a091';
  attempt_id uuid;
BEGIN
  INSERT INTO auth.users(id,email) VALUES(v_user_id,'oauth-regression@example.invalid');
  SELECT id INTO attempt_id FROM public.create_gbp_oauth_attempt_v1(
    v_restaurant_id,v_user_id,repeat('a',64),repeat('b',64),'/settings/restaurant/google-business-profile',
    clock_timestamp()+interval '10 minutes',NULL,NULL,NULL,NULL,1,1);
  BEGIN
    PERFORM public.consume_gbp_oauth_attempt_v1(v_other_restaurant_id,repeat('a',64),repeat('b',64),NULL,NULL,NULL,NULL,1,1);
    RAISE EXCEPTION 'Cross-tenant OAuth attempt consumed' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found OR insufficient_privilege THEN NULL;
  END;
  PERFORM public.consume_gbp_oauth_attempt_v1(v_restaurant_id,repeat('a',64),repeat('b',64),NULL,NULL,NULL,NULL,1,1);
  PERFORM public.create_gbp_oauth_attempt_v1(
    v_restaurant_id,v_user_id,repeat('c',64),repeat('d',64),'/settings/restaurant/google-business-profile',
    clock_timestamp()+interval '10 minutes',NULL,NULL,NULL,NULL,1,1);
  IF NOT EXISTS(SELECT 1 FROM public.restaurant_external_profile_oauth_states
    WHERE id=attempt_id AND restaurant_id = v_restaurant_id AND consumed_at IS NOT NULL
      AND invalidated_at IS NULL AND invalidation_reason IS NULL) THEN
    RAISE EXCEPTION 'New OAuth attempt modified an already consumed terminal state' USING ERRCODE = 'NB001';
  END IF;
  BEGIN
    PERFORM public.consume_gbp_oauth_attempt_v1(v_restaurant_id,repeat('a',64),repeat('b',64),NULL,NULL,NULL,NULL,1,1);
    RAISE EXCEPTION 'Consumed OAuth attempt replayed' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN no_data_found THEN NULL;
  END;
  RAISE NOTICE 'GBP OAuth terminal state regression PASSED';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'GBP OAuth terminal state regression FAILED: %',SQLERRM;
    RAISE;
END;
$regression$;
ROLLBACK;
