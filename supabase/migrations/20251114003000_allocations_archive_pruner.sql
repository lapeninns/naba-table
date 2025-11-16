BEGIN;

-- Create archive table for historical allocations (used for pruning instead of partitioning).
CREATE TABLE IF NOT EXISTS public.allocations_archive (
    id uuid NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    shadow boolean NOT NULL DEFAULT false,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean NOT NULL DEFAULT false,
    archived_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT allocations_archive_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text])))
);

ALTER TABLE public.allocations_archive
    ADD CONSTRAINT allocations_archive_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS allocations_archive_restaurant_idx ON public.allocations_archive USING btree (restaurant_id);
CREATE INDEX IF NOT EXISTS allocations_archive_booking_idx ON public.allocations_archive USING btree (booking_id);

ALTER TABLE public.allocations_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant service role can manage allocations archive" ON public.allocations_archive;
CREATE POLICY "Tenant service role can manage allocations archive"
  ON public.allocations_archive
  TO service_role
  USING ((restaurant_id = public.require_restaurant_context()))
  WITH CHECK ((restaurant_id = public.require_restaurant_context()));

-- Function to move old allocations into archive (cutoff determined by caller).
CREATE OR REPLACE FUNCTION public.prune_allocations_history(
  p_cutoff timestamptz,
  p_limit integer DEFAULT 500
) RETURNS TABLE(archived_count integer, deleted_count integer)
LANGUAGE plpgsql
AS $$
BEGIN
  WITH candidates AS (
    SELECT
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance
    FROM public.allocations
    WHERE upper("window") < p_cutoff
    ORDER BY updated_at
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.allocations_archive (
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance,
      archived_at
    )
    SELECT
      c.id,
      c.booking_id,
      c.resource_type,
      c.resource_id,
      c.created_at,
      c.updated_at,
      c.shadow,
      c.restaurant_id,
      c."window",
      c.created_by,
      c.is_maintenance,
      timezone('utc'::text, now())
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ), deleted AS (
    DELETE FROM public.allocations a
    USING inserted i
    WHERE a.id = i.id
    RETURNING a.id
  )
  SELECT * INTO archived_count, deleted_count FROM (
    SELECT
      COALESCE((SELECT count(*) FROM inserted), 0)::integer AS archived_count,
      COALESCE((SELECT count(*) FROM deleted), 0)::integer AS deleted_count
  ) subq;
  
  RETURN QUERY SELECT archived_count, deleted_count;
END;
$$;

GRANT ALL ON FUNCTION public.prune_allocations_history(timestamptz, integer) TO service_role;

COMMIT;
