-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;
SET LOCAL search_path = public;
DO $regression$
DECLARE
  v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001';
  b uuid := '00000000-0000-4000-8000-00000000a002';
  booking uuid := '00000000-0000-4000-8000-00000000b001';
  second_booking uuid := '00000000-0000-4000-8000-00000000b002';
  first_request jsonb;
  replay jsonb;
  lease uuid;
  newer_lease uuid;
  finished boolean;
BEGIN
  -- Executes the full production function under its restrictive search path.
  first_request := public.schedule_review_request_v1(booking, v_restaurant_id, '2099-01-02 12:00Z', true, true);
  replay := public.schedule_review_request_v1(booking, v_restaurant_id, '2099-01-03 12:00Z', true, true);
  IF first_request->>'reviewRequestId' IS DISTINCT FROM replay->>'reviewRequestId'
     OR replay->>'scheduledFor' IS DISTINCT FROM first_request->>'scheduledFor'
     OR first_request->>'primaryChannel' <> 'whatsapp' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Journey idempotency or channel sequencing failed';
  END IF;
  IF (SELECT guest_key_hash FROM public.review_requests WHERE booking_id = booking) IS DISTINCT FROM
    encode(extensions.digest(v_restaurant_id::text || ':00000000-0000-4000-8000-00000000c001', 'sha256'), 'hex') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Hash mismatch';
  END IF;
  BEGIN
    PERFORM public.schedule_review_request_v1(booking, b, '2099-01-02 12:00Z', true, true);
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Cross-tenant scheduler allowed';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN raise_exception THEN NULL;
  END;
  UPDATE public.bookings SET status = 'completed', checked_in_at = start_at, checked_out_at = end_at WHERE id = second_booking AND restaurant_id = v_restaurant_id;
  replay := public.schedule_review_request_v1(second_booking, v_restaurant_id, '2099-01-04 12:00Z', true, true);
  IF replay->>'suppressionReason' IS DISTINCT FROM 'guest_cooldown' THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Cooldown not preserved';
  END IF;
  IF (SELECT count(*) FROM public.review_scheduling_jobs WHERE restaurant_id = v_restaurant_id) <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Completion did not persist jobs';
  END IF;
  -- Restrict claims to synthetic rows; never consume another staging tenant's work.
  UPDATE public.review_scheduling_jobs SET next_attempt_at = '1900-01-01' WHERE booking_id = booking AND restaurant_id = v_restaurant_id;
  SELECT claim_token INTO lease FROM public.claim_review_scheduling_jobs_v1(1) WHERE booking_id = booking AND restaurant_id = v_restaurant_id;
  IF lease IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Missing initial lease'; END IF;
  IF public.finish_review_scheduling_job_v1(booking, b, lease, NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Cross-tenant finish allowed';
  END IF;
  UPDATE public.review_scheduling_jobs SET claimed_at = now() - interval '16 minutes' WHERE booking_id = booking AND restaurant_id = v_restaurant_id;
  SELECT claim_token INTO newer_lease FROM public.claim_review_scheduling_jobs_v1(1) WHERE booking_id = booking AND restaurant_id = v_restaurant_id;
  IF newer_lease IS NULL OR newer_lease = lease OR public.finish_review_scheduling_job_v1(booking, v_restaurant_id, lease, NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Stale lease not fenced';
  END IF;
  finished := public.finish_review_scheduling_job_v1(booking, v_restaurant_id, newer_lease, '42883');
  IF NOT finished OR NOT EXISTS (
    SELECT 1 FROM public.review_scheduling_jobs WHERE booking_id = booking AND status = 'pending'
      AND next_attempt_at > now() AND last_error_code = '42883'
  ) THEN RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Failure not retained'; END IF;
  IF public.recover_review_scheduling_jobs_v1(v_restaurant_id, ARRAY[booking]) <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Recovery duplicated work';
  END IF;
  BEGIN
    PERFORM public.recover_review_scheduling_jobs_v1(b, ARRAY[booking]);
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Cross-tenant recovery allowed';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN raise_exception THEN NULL;
  END;
  IF has_function_privilege('authenticated', 'public.claim_review_scheduling_jobs_v1(integer)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.review_scheduling_jobs', 'SELECT') THEN
    RAISE EXCEPTION USING ERRCODE = 'NB001', MESSAGE = 'Retry ledger exposed to authenticated users';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Review scheduling regression FAILED';
    RAISE;
END;
$regression$;
ROLLBACK;
