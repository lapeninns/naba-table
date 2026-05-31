CREATE OR REPLACE FUNCTION public.delete_restaurant_menu_section_hierarchy(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_ids uuid[];
BEGIN
  PERFORM 1
  FROM public.restaurant_menu_sections
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND id = p_section_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu section not found for hierarchy delete'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO item_ids
  FROM (
    SELECT id
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND menu_id = p_menu_id
      AND section_id = p_section_id
    FOR UPDATE
  ) locked_items;

  DELETE FROM public.restaurant_menu_item_options
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = ANY(item_ids);

  DELETE FROM public.restaurant_menu_item_extensions
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = ANY(item_ids);

  DELETE FROM public.restaurant_menu_items
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND section_id = p_section_id;

  DELETE FROM public.restaurant_menu_sections
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND id = p_section_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_restaurant_menu_hierarchy(
  p_restaurant_id uuid,
  p_menu_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_ids uuid[];
BEGIN
  PERFORM 1
  FROM public.restaurant_menus
  WHERE restaurant_id = p_restaurant_id
    AND id = p_menu_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu not found for hierarchy delete'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO item_ids
  FROM (
    SELECT id
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND menu_id = p_menu_id
    FOR UPDATE
  ) locked_items;

  DELETE FROM public.restaurant_menu_item_options
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = ANY(item_ids);

  DELETE FROM public.restaurant_menu_item_extensions
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = ANY(item_ids);

  DELETE FROM public.restaurant_menu_items
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id;

  DELETE FROM public.restaurant_menu_sections
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id;

  DELETE FROM public.restaurant_menus
  WHERE restaurant_id = p_restaurant_id
    AND id = p_menu_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_restaurant_menu_section_hierarchy(uuid, uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_restaurant_menu_section_hierarchy(uuid, uuid, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.delete_restaurant_menu_section_hierarchy(uuid, uuid, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_menu_section_hierarchy(uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.delete_restaurant_menu_hierarchy(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_restaurant_menu_hierarchy(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_restaurant_menu_hierarchy(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_menu_hierarchy(uuid, uuid) TO service_role;
