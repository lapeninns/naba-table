-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql
BEGIN;

DO $regression$
DECLARE
  v_actor constant uuid := '00000000-0000-4000-8000-00000000a001';
  v_now timestamptz := timezone('utc', now());
  v_evidence_id uuid;
  v_hash text;
  v_ready public.gbp_content_retention_readiness_v1;
  v_retention_at timestamptz;
BEGIN
  IF (SELECT count(*) FROM public.restaurants WHERE id IN (
    '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a002'
  )) <> 2 THEN
    RAISE EXCEPTION 'Synthetic fixtures are required' USING ERRCODE = 'NB001';
  END IF;
  INSERT INTO public.gbp_write_policy_config_v1 (
    backup_window_days, proven_content_ttl_days, policy_version, renderer_version,
    approved_by_user_id, approved_at
  ) VALUES (7, 22, 'synthetic-retention-v2', 'synthetic-renderer', v_actor, v_now)
  ON CONFLICT (provider) DO UPDATE SET
    backup_window_days = EXCLUDED.backup_window_days,
    proven_content_ttl_days = EXCLUDED.proven_content_ttl_days,
    policy_version = EXCLUDED.policy_version,
    renderer_version = EXCLUDED.renderer_version,
    approved_by_user_id = EXCLUDED.approved_by_user_id,
    approved_at = EXCLUDED.approved_at,
    created_at = v_now;

  INSERT INTO public.gbp_write_readiness_evidence_v1 (
    policy_version, renderer_version, backup_window_days, live_content_ttl_days,
    backup_retention_verified_at, backup_restore_verified_at, pitr_verified_at,
    policy_approved_at, transformed_content_approved_at, issued_by_user_id, issued_at, valid_until
  ) VALUES (
    'synthetic-retention-v2', 'synthetic-renderer', 7, 22,
    v_now, NULL, v_now, v_now, v_now, v_actor, v_now, v_now + interval '1 day'
  ) RETURNING id, evidence_hash INTO v_evidence_id, v_hash;

  SELECT * INTO v_ready FROM public.get_gbp_content_retention_readiness_v1(v_now);
  IF v_ready.ready IS DISTINCT FROM true OR v_ready.computed_live_ttl_days <> 22 THEN
    RAISE EXCEPTION 'Current retention evidence must permit storage without a restore drill'
      USING ERRCODE = 'NB001';
  END IF;
  IF v_hash !~ '^[a-f0-9]{64}$' OR EXISTS (
    SELECT 1 FROM public.gbp_write_readiness_evidence_v1
    WHERE id = v_evidence_id AND backup_restore_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Evidence must retain its hash and explicitly unverified restore'
      USING ERRCODE = 'NB001';
  END IF;

  SELECT * INTO v_ready FROM public.get_gbp_content_retention_readiness_v1(v_now + interval '1 day');
  IF v_ready.ready IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expired evidence must not permit storage' USING ERRCODE = 'NB001';
  END IF;

  FOREACH v_retention_at IN ARRAY ARRAY[NULL::timestamptz, v_now - interval '31 days', v_now + interval '1 day']
  LOOP
    BEGIN
      INSERT INTO public.gbp_write_readiness_evidence_v1 (
        policy_version, renderer_version, backup_window_days, live_content_ttl_days,
        backup_retention_verified_at, backup_restore_verified_at, pitr_verified_at,
        policy_approved_at, transformed_content_approved_at, issued_by_user_id, issued_at, valid_until
      ) VALUES (
        'synthetic-retention-v2', 'synthetic-renderer', 7, 22,
        v_retention_at, NULL, v_now, v_now, v_now, v_actor, v_now, v_now + interval '1 day'
      );
      RAISE EXCEPTION 'Missing, stale and future retention verification must be rejected'
        USING ERRCODE = 'NB001';
    EXCEPTION
      WHEN SQLSTATE 'NB001' THEN RAISE;
      WHEN check_violation THEN NULL;
    END;
  END LOOP;

  BEGIN
    INSERT INTO public.gbp_write_readiness_evidence_v1 (
      policy_version, renderer_version, backup_window_days, live_content_ttl_days,
      backup_retention_verified_at, pitr_verified_at, policy_approved_at,
      transformed_content_approved_at, issued_by_user_id, issued_at, valid_until
    ) VALUES (
      'synthetic-retention-v2', 'synthetic-renderer', 7, 22,
      v_now - interval '29 days', v_now, v_now, v_now, v_actor, v_now, v_now + interval '2 days'
    );
    RAISE EXCEPTION 'Readiness cannot outlive its retention verification' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.gbp_write_readiness_evidence_v1 SET backup_restore_verified_at = v_now
    WHERE id = v_evidence_id;
    RAISE EXCEPTION 'Evidence must remain append-only' USING ERRCODE = 'NB001';
  EXCEPTION
    WHEN SQLSTATE 'NB001' THEN RAISE;
    WHEN object_not_in_prerequisite_state THEN NULL;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'GBP retention readiness regression FAILED: %', SQLERRM;
    RAISE;
END;
$regression$;

ROLLBACK;
