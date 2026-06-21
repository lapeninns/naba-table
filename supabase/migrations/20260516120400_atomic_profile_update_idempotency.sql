CREATE UNIQUE INDEX IF NOT EXISTS profile_update_requests_profile_id_idempotency_key_idx
  ON public.profile_update_requests (profile_id, idempotency_key);

CREATE OR REPLACE FUNCTION public.apply_profile_update_idempotent(
  p_profile_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_set_name boolean,
  p_name text,
  p_set_phone boolean,
  p_phone text,
  p_set_image boolean,
  p_image text
)
RETURNS TABLE (
  status text,
  profile jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_hash text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'p_profile_id is required' USING ERRCODE = '22004';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'p_idempotency_key is required' USING ERRCODE = '22004';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_payload_hash, '')), '') IS NULL THEN
    RAISE EXCEPTION 'p_payload_hash is required' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.profile_update_requests (
    profile_id,
    idempotency_key,
    payload_hash,
    applied_at
  )
  VALUES (
    p_profile_id,
    p_idempotency_key,
    p_payload_hash,
    timezone('utc', now())
  )
  ON CONFLICT (profile_id, idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT request.payload_hash
    INTO v_existing_hash
    FROM public.profile_update_requests request
    WHERE request.profile_id = p_profile_id
      AND request.idempotency_key = p_idempotency_key;

    IF v_existing_hash IS DISTINCT FROM p_payload_hash THEN
      SELECT profile_row.*
      INTO v_profile
      FROM public.profiles profile_row
      WHERE profile_row.id = p_profile_id;

      RETURN QUERY SELECT 'conflict'::text, to_jsonb(v_profile);
      RETURN;
    END IF;

    SELECT profile_row.*
    INTO v_profile
    FROM public.profiles profile_row
    WHERE profile_row.id = p_profile_id;

    RETURN QUERY SELECT 'idempotent'::text, to_jsonb(v_profile);
    RETURN;
  END IF;

  UPDATE public.profiles profile_row
  SET
    name = CASE WHEN COALESCE(p_set_name, false) THEN p_name ELSE profile_row.name END,
    phone = CASE WHEN COALESCE(p_set_phone, false) THEN p_phone ELSE profile_row.phone END,
    image = CASE WHEN COALESCE(p_set_image, false) THEN p_image ELSE profile_row.image END,
    updated_at = timezone('utc', now())
  WHERE profile_row.id = p_profile_id
  RETURNING profile_row.*
  INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT 'applied'::text, to_jsonb(v_profile);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_profile_update_idempotent(
  uuid,
  text,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_profile_update_idempotent(
  uuid,
  text,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_profile_update_idempotent(
  uuid,
  text,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text
) TO service_role;
