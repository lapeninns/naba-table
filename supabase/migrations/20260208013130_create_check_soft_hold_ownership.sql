CREATE OR REPLACE FUNCTION public.check_soft_hold_ownership(
  p_session_token uuid,
  p_table_ids uuid[],
  p_window tstzrange
) RETURNS TABLE(
  table_id uuid,
  owned boolean,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_table_id uuid;
  v_hold RECORD;
BEGIN
  FOREACH v_table_id IN ARRAY p_table_ids LOOP
    SELECT sh.expires_at
    INTO v_hold
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.session_token = p_session_token
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
    LIMIT 1;

    table_id := v_table_id;
    IF FOUND THEN
      owned := true;
      expires_at := v_hold.expires_at;
    ELSE
      owned := false;
      expires_at := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

