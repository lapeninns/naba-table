CREATE OR REPLACE FUNCTION public.replace_restaurant_business_context_core(
  p_restaurant_id uuid,
  p_business_details jsonb DEFAULT NULL,
  p_links jsonb DEFAULT NULL,
  p_categories jsonb DEFAULT NULL,
  p_service_areas jsonb DEFAULT NULL,
  p_attributes jsonb DEFAULT NULL,
  p_service_items jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('restaurant_business_context:' || p_restaurant_id::text));

  IF p_business_details IS NOT NULL THEN
    INSERT INTO public.restaurant_business_details (
      restaurant_id,
      opening_date,
      business_status,
      is_service_area_business,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      p_restaurant_id,
      row.opening_date,
      row.business_status,
      COALESCE(row.is_service_area_business, false),
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      row.last_manual_override_at
    FROM jsonb_to_record(p_business_details) AS row(
      opening_date date,
      business_status text,
      is_service_area_business boolean,
      last_manual_override_at timestamptz
    )
    ON CONFLICT (restaurant_id, source, managed_by) DO UPDATE
    SET
      opening_date = EXCLUDED.opening_date,
      business_status = EXCLUDED.business_status,
      is_service_area_business = EXCLUDED.is_service_area_business,
      last_manual_override_at = EXCLUDED.last_manual_override_at,
      updated_at = now();
  END IF;

  IF p_links IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.replace_restaurant_business_context_links;

    CREATE TEMP TABLE replace_restaurant_business_context_links ON COMMIT DROP AS
    SELECT
      row.id,
      row.link_type,
      COALESCE(row.link_status, 'current') AS link_status,
      row.label,
      row.url,
      COALESCE(row.is_primary, false) AS is_primary,
      COALESCE(row.display_order, 0) AS display_order,
      row.last_manual_override_at
    FROM jsonb_to_recordset(p_links) AS row(
      id uuid,
      link_type text,
      link_status text,
      label text,
      url text,
      is_primary boolean,
      display_order integer,
      last_manual_override_at timestamptz
    );

    IF EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_business_context_links
      GROUP BY id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate business-context link id';
    END IF;

    DELETE FROM public.restaurant_links
    WHERE restaurant_id = p_restaurant_id
      AND source = 'nabatable'
      AND managed_by = 'nabatable'
      AND link_type IN (
        'website',
        'menu_or_services',
        'reservation',
        'order',
        'chat',
        'facebook',
        'instagram',
        'x',
        'youtube',
        'tiktok',
        'linkedin',
        'other'
      );

    INSERT INTO public.restaurant_links (
      id,
      restaurant_id,
      link_type,
      link_status,
      label,
      url,
      is_primary,
      display_order,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      incoming.id,
      p_restaurant_id,
      incoming.link_type,
      incoming.link_status,
      incoming.label,
      incoming.url,
      incoming.is_primary,
      incoming.display_order,
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      incoming.last_manual_override_at
    FROM pg_temp.replace_restaurant_business_context_links incoming;
  END IF;

  IF p_categories IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.replace_restaurant_business_context_categories;

    CREATE TEMP TABLE replace_restaurant_business_context_categories ON COMMIT DROP AS
    SELECT
      row.id,
      row.display_name,
      row.category_code,
      COALESCE(row.more_hours_types_json, '[]'::jsonb) AS more_hours_types_json,
      COALESCE(row.is_primary, false) AS is_primary,
      COALESCE(row.display_order, 0) AS display_order,
      row.last_manual_override_at
    FROM jsonb_to_recordset(p_categories) AS row(
      id uuid,
      display_name text,
      category_code text,
      more_hours_types_json jsonb,
      is_primary boolean,
      display_order integer,
      last_manual_override_at timestamptz
    );

    IF EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_business_context_categories
      GROUP BY id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate business-context category id';
    END IF;

    DELETE FROM public.restaurant_categories
    WHERE restaurant_id = p_restaurant_id
      AND source = 'nabatable'
      AND managed_by = 'nabatable';

    INSERT INTO public.restaurant_categories (
      id,
      restaurant_id,
      display_name,
      category_code,
      more_hours_types_json,
      is_primary,
      display_order,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      incoming.id,
      p_restaurant_id,
      incoming.display_name,
      incoming.category_code,
      incoming.more_hours_types_json,
      incoming.is_primary,
      incoming.display_order,
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      incoming.last_manual_override_at
    FROM pg_temp.replace_restaurant_business_context_categories incoming;
  END IF;

  IF p_service_areas IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.replace_restaurant_business_context_service_areas;

    CREATE TEMP TABLE replace_restaurant_business_context_service_areas ON COMMIT DROP AS
    SELECT
      row.id,
      row.display_name,
      COALESCE(row.area_type, 'region') AS area_type,
      row.region_code,
      row.google_place_id,
      row.google_place_resource_name,
      COALESCE(row.place_data_json, '{}'::jsonb) AS place_data_json,
      COALESCE(row.display_order, 0) AS display_order,
      row.last_manual_override_at
    FROM jsonb_to_recordset(p_service_areas) AS row(
      id uuid,
      display_name text,
      area_type text,
      region_code text,
      google_place_id text,
      google_place_resource_name text,
      place_data_json jsonb,
      display_order integer,
      last_manual_override_at timestamptz
    );

    IF EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_business_context_service_areas
      GROUP BY id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate business-context service-area id';
    END IF;

    DELETE FROM public.restaurant_service_areas
    WHERE restaurant_id = p_restaurant_id
      AND source = 'nabatable'
      AND managed_by = 'nabatable';

    INSERT INTO public.restaurant_service_areas (
      id,
      restaurant_id,
      display_name,
      area_type,
      region_code,
      google_place_id,
      google_place_resource_name,
      place_data_json,
      display_order,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      incoming.id,
      p_restaurant_id,
      incoming.display_name,
      incoming.area_type,
      incoming.region_code,
      incoming.google_place_id,
      incoming.google_place_resource_name,
      incoming.place_data_json,
      incoming.display_order,
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      incoming.last_manual_override_at
    FROM pg_temp.replace_restaurant_business_context_service_areas incoming;
  END IF;

  IF p_attributes IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.replace_restaurant_business_context_attributes;

    CREATE TEMP TABLE replace_restaurant_business_context_attributes ON COMMIT DROP AS
    SELECT
      row.id,
      row.attribute_group,
      row.attribute_key,
      row.attribute_name,
      row.attribute_id,
      row.display_name,
      row.display_text,
      row.display_text_standalone,
      row.display_text_negative,
      row.value_type,
      row.bool_value,
      row.text_value,
      row.uri_value,
      COALESCE(row.uri_values, '[]'::jsonb) AS uri_values,
      COALESCE(row.enum_values, '[]'::jsonb) AS enum_values,
      COALESCE(row.unset_enum_values, '[]'::jsonb) AS unset_enum_values,
      COALESCE(row.raw_value_json, '{}'::jsonb) AS raw_value_json,
      COALESCE(row.raw_enum_values_json, '{}'::jsonb) AS raw_enum_values_json,
      COALESCE(row.display_value_json, '{}'::jsonb) AS display_value_json,
      COALESCE(row.value_metadata_json, '[]'::jsonb) AS value_metadata_json,
      COALESCE(row.display_order, 0) AS display_order,
      row.last_manual_override_at
    FROM jsonb_to_recordset(p_attributes) AS row(
      id uuid,
      attribute_group text,
      attribute_key text,
      attribute_name text,
      attribute_id text,
      display_name text,
      display_text text,
      display_text_standalone text,
      display_text_negative text,
      value_type text,
      bool_value boolean,
      text_value text,
      uri_value text,
      uri_values jsonb,
      enum_values jsonb,
      unset_enum_values jsonb,
      raw_value_json jsonb,
      raw_enum_values_json jsonb,
      display_value_json jsonb,
      value_metadata_json jsonb,
      display_order integer,
      last_manual_override_at timestamptz
    );

    IF EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_business_context_attributes
      GROUP BY id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate business-context attribute id';
    END IF;

    DELETE FROM public.restaurant_attributes
    WHERE restaurant_id = p_restaurant_id
      AND source = 'nabatable'
      AND managed_by = 'nabatable';

    INSERT INTO public.restaurant_attributes (
      id,
      restaurant_id,
      attribute_group,
      attribute_key,
      attribute_name,
      attribute_id,
      display_name,
      display_text,
      display_text_standalone,
      display_text_negative,
      value_type,
      bool_value,
      text_value,
      uri_value,
      uri_values,
      enum_values,
      unset_enum_values,
      raw_value_json,
      raw_enum_values_json,
      display_value_json,
      value_metadata_json,
      display_order,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      incoming.id,
      p_restaurant_id,
      incoming.attribute_group,
      incoming.attribute_key,
      incoming.attribute_name,
      incoming.attribute_id,
      incoming.display_name,
      incoming.display_text,
      incoming.display_text_standalone,
      incoming.display_text_negative,
      incoming.value_type,
      incoming.bool_value,
      incoming.text_value,
      incoming.uri_value,
      incoming.uri_values,
      incoming.enum_values,
      incoming.unset_enum_values,
      incoming.raw_value_json,
      incoming.raw_enum_values_json,
      incoming.display_value_json,
      incoming.value_metadata_json,
      incoming.display_order,
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      incoming.last_manual_override_at
    FROM pg_temp.replace_restaurant_business_context_attributes incoming;
  END IF;

  IF p_service_items IS NOT NULL THEN
    DROP TABLE IF EXISTS pg_temp.replace_restaurant_business_context_service_items;

    CREATE TEMP TABLE replace_restaurant_business_context_service_items ON COMMIT DROP AS
    SELECT
      row.id,
      row.item_key,
      row.item_type,
      row.display_name,
      row.description,
      COALESCE(row.payload_json, '{}'::jsonb) AS payload_json,
      COALESCE(row.display_order, 0) AS display_order,
      row.last_manual_override_at
    FROM jsonb_to_recordset(p_service_items) AS row(
      id uuid,
      item_key text,
      item_type text,
      display_name text,
      description text,
      payload_json jsonb,
      display_order integer,
      last_manual_override_at timestamptz
    );

    IF EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_business_context_service_items
      GROUP BY id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate business-context service-item id';
    END IF;

    DELETE FROM public.restaurant_service_items
    WHERE restaurant_id = p_restaurant_id
      AND source = 'nabatable'
      AND managed_by = 'nabatable';

    INSERT INTO public.restaurant_service_items (
      id,
      restaurant_id,
      item_key,
      item_type,
      display_name,
      description,
      payload_json,
      display_order,
      source,
      managed_by,
      source_record_id,
      last_synced_at,
      last_manual_override_at
    )
    SELECT
      incoming.id,
      p_restaurant_id,
      incoming.item_key,
      incoming.item_type,
      incoming.display_name,
      incoming.description,
      incoming.payload_json,
      incoming.display_order,
      'nabatable',
      'nabatable',
      NULL,
      NULL,
      incoming.last_manual_override_at
    FROM pg_temp.replace_restaurant_business_context_service_items incoming;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_core(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_core(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_core(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_restaurant_business_context_core(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) TO service_role;
