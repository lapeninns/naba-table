ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_decision_status_check;

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  ADD CONSTRAINT restaurant_gbp_food_menu_import_reviews_decision_status_check
    CHECK (decision_status IN ('pending', 'processing', 'approved', 'ignored', 'applied', 'superseded'));

CREATE OR REPLACE FUNCTION public.replace_pending_food_menus_import_reviews(
  p_restaurant_id uuid,
  p_google_snapshot_id uuid DEFAULT NULL,
  p_projection_snapshot_id uuid DEFAULT NULL,
  p_reviews jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.restaurant_gbp_food_menu_import_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.restaurant_gbp_food_menu_import_reviews
  SET
    decision_status = 'superseded',
    updated_at = timezone('utc', now())
  WHERE restaurant_id = p_restaurant_id
    AND decision_status = 'pending';

  IF jsonb_array_length(COALESCE(p_reviews, '[]'::jsonb)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.restaurant_gbp_food_menu_import_reviews (
    restaurant_id,
    google_snapshot_id,
    projection_snapshot_id,
    menu_item_id,
    external_item_id,
    target_kind,
    google_path,
    google_section_label,
    google_item_name,
    match_status,
    match_confidence,
    suggested_patch,
    warnings,
    decision_status
  )
  SELECT
    p_restaurant_id,
    p_google_snapshot_id,
    p_projection_snapshot_id,
    review_rows.menu_item_id,
    review_rows.external_item_id,
    review_rows.target_kind,
    review_rows.google_path,
    review_rows.google_section_label,
    review_rows.google_item_name,
    review_rows.match_status,
    review_rows.match_confidence,
    review_rows.suggested_patch,
    COALESCE(review_rows.warnings, '[]'::jsonb),
    'pending'
  FROM jsonb_to_recordset(COALESCE(p_reviews, '[]'::jsonb)) AS review_rows(
    menu_item_id uuid,
    external_item_id text,
    target_kind text,
    google_path text,
    google_section_label text,
    google_item_name text,
    match_status text,
    match_confidence text,
    suggested_patch jsonb,
    warnings jsonb
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_pending_food_menus_import_reviews(uuid, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_pending_food_menus_import_reviews(uuid, uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_pending_food_menus_import_reviews(uuid, uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_pending_food_menus_import_reviews(uuid, uuid, uuid, jsonb) TO service_role;
