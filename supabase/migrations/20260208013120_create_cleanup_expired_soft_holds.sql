CREATE OR REPLACE FUNCTION public.cleanup_expired_soft_holds(
  p_batch_size integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id
    FROM public.table_soft_holds
    WHERE expires_at <= timezone('utc', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

