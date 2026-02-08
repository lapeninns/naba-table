CREATE OR REPLACE FUNCTION public.release_soft_holds(
  p_session_token uuid,
  p_table_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token
      AND table_id = ANY(p_table_ids);
  ELSE
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

