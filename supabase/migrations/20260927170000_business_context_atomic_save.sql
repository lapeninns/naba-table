-- Discovery (business-context) saves become one transaction with their audit rows and a
-- per-restaurant revision precondition.
--
-- Before: the app called replace_restaurant_business_context_core() and then inserted
-- restaurant_profile_change_log rows in a second request, outside the transaction, and saves
-- had no stale-write protection.
--
-- After:
--   * restaurant_business_context_revisions keeps one monotonically increasing revision per
--     restaurant. It is service-role only (RLS on, no policies, no grants to API roles).
--   * replace_restaurant_business_context_v2() takes the same advisory lock as the core RPC,
--     checks p_expected_revision (when given) against the stored revision, applies the
--     replacement through the unchanged core RPC, writes the change-log rows and bumps the
--     revision, all in one transaction. A stale revision writes nothing and returns
--     {"status":"stale","revision":<current>}; success returns {"status":"applied","revision":<new>}.
--   * get_restaurant_business_context_revision_v1() reads the current revision (0 when the
--     restaurant has never been saved through v2).
--
-- Backward safety: the core RPC is untouched, so app instances that still call it keep working
-- (their writes do not bump the revision). No existing data is modified.
--
-- Rollback (manual, no data loss outside the revision counter):
--   DROP FUNCTION IF EXISTS public.replace_restaurant_business_context_v2(
--     uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint);
--   DROP FUNCTION IF EXISTS public.get_restaurant_business_context_revision_v1(uuid);
--   DROP TABLE IF EXISTS public.restaurant_business_context_revisions;
-- The app falls back to the core RPC plus a separate change-log insert when v2 is missing.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_business_context_revisions (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_business_context_revisions_revision_check CHECK (revision >= 0)
);

ALTER TABLE public.restaurant_business_context_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.restaurant_business_context_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.restaurant_business_context_revisions FROM anon;
REVOKE ALL ON TABLE public.restaurant_business_context_revisions FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.restaurant_business_context_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.get_restaurant_business_context_revision_v1(
  p_restaurant_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT revisions.revision
      FROM public.restaurant_business_context_revisions AS revisions
      WHERE revisions.restaurant_id = p_restaurant_id
    ),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.replace_restaurant_business_context_v2(
  p_restaurant_id uuid,
  p_business_details jsonb DEFAULT NULL,
  p_links jsonb DEFAULT NULL,
  p_categories jsonb DEFAULT NULL,
  p_service_areas jsonb DEFAULT NULL,
  p_attributes jsonb DEFAULT NULL,
  p_service_items jsonb DEFAULT NULL,
  p_change_log_rows jsonb DEFAULT NULL,
  p_expected_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current bigint;
  v_next bigint;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant id is required' USING ERRCODE = '22023';
  END IF;
  IF p_change_log_rows IS NOT NULL AND jsonb_typeof(p_change_log_rows) <> 'array' THEN
    RAISE EXCEPTION 'change-log rows must be a JSON array' USING ERRCODE = '22023';
  END IF;

  -- Same key as replace_restaurant_business_context_core (re-entrant within this transaction),
  -- so the revision check and the replacement are serialized with every other writer.
  PERFORM pg_advisory_xact_lock(hashtext('restaurant_business_context:' || p_restaurant_id::text));

  SELECT revisions.revision
  INTO v_current
  FROM public.restaurant_business_context_revisions AS revisions
  WHERE revisions.restaurant_id = p_restaurant_id
  FOR UPDATE;
  v_current := COALESCE(v_current, 0);

  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_current THEN
    RETURN jsonb_build_object('status', 'stale', 'revision', v_current);
  END IF;

  PERFORM public.replace_restaurant_business_context_core(
    p_restaurant_id,
    p_business_details,
    p_links,
    p_categories,
    p_service_areas,
    p_attributes,
    p_service_items
  );

  INSERT INTO public.restaurant_profile_change_log (
    restaurant_id,
    entity_table,
    field_path,
    old_value,
    new_value,
    change_origin,
    changed_by_user_id,
    changed_via,
    change_reason,
    external_profile_id,
    external_provider,
    draft_id,
    publish_job_id,
    publish_event_id,
    status,
    detected_at,
    applied_at,
    metadata
  )
  SELECT
    p_restaurant_id,
    row.entity_table,
    COALESCE(row.field_path, '$'),
    row.old_value,
    row.new_value,
    row.change_origin,
    row.changed_by_user_id,
    row.changed_via,
    row.change_reason,
    row.external_profile_id,
    row.external_provider,
    row.draft_id,
    row.publish_job_id,
    row.publish_event_id,
    COALESCE(row.status, 'applied'),
    COALESCE(row.detected_at, now()),
    row.applied_at,
    COALESCE(row.metadata, '{}'::jsonb)
  FROM jsonb_to_recordset(COALESCE(p_change_log_rows, '[]'::jsonb)) AS row(
    entity_table text,
    field_path text,
    old_value jsonb,
    new_value jsonb,
    change_origin text,
    changed_by_user_id uuid,
    changed_via text,
    change_reason text,
    external_profile_id uuid,
    external_provider text,
    draft_id uuid,
    publish_job_id uuid,
    publish_event_id uuid,
    status text,
    detected_at timestamptz,
    applied_at timestamptz,
    metadata jsonb
  );

  INSERT INTO public.restaurant_business_context_revisions AS revisions (
    restaurant_id,
    revision,
    updated_at
  )
  VALUES (p_restaurant_id, 1, now())
  ON CONFLICT (restaurant_id) DO UPDATE
  SET revision = revisions.revision + 1,
      updated_at = now()
  RETURNING revisions.revision INTO v_next;

  RETURN jsonb_build_object('status', 'applied', 'revision', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_business_context_revision_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_restaurant_business_context_revision_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_restaurant_business_context_revision_v1(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_restaurant_business_context_revision_v1(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_v2(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_v2(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_v2(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_restaurant_business_context_v2(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, bigint
) TO service_role;

COMMIT;
