CREATE OR REPLACE FUNCTION public.replace_gbp_canonical_business_info(
  p_restaurant_id uuid,
  p_external_profile_id uuid,
  p_location_snapshot jsonb,
  p_location_source_revision text,
  p_location_payload_hash text,
  p_attributes_snapshot jsonb DEFAULT NULL,
  p_attributes_source_revision text DEFAULT NULL,
  p_attributes_payload_hash text DEFAULT NULL,
  p_business_details jsonb DEFAULT NULL,
  p_addresses jsonb DEFAULT '[]'::jsonb,
  p_phone_numbers jsonb DEFAULT '[]'::jsonb,
  p_links jsonb DEFAULT '[]'::jsonb,
  p_categories jsonb DEFAULT '[]'::jsonb,
  p_service_areas jsonb DEFAULT '[]'::jsonb,
  p_hours jsonb DEFAULT '[]'::jsonb,
  p_attributes jsonb DEFAULT NULL,
  p_service_items jsonb DEFAULT NULL,
  p_field_sync_statuses jsonb DEFAULT '[]'::jsonb,
  p_field_sync_entity_tables text[] DEFAULT ARRAY[]::text[],
  p_profile_change_log_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gbp_canonical_business_info:' || p_restaurant_id::text));

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurant_external_profiles profile
    WHERE profile.id = p_external_profile_id
      AND profile.restaurant_id = p_restaurant_id
      AND profile.provider = 'google_business_profile'
  ) THEN
    RAISE EXCEPTION 'GBP external profile does not belong to restaurant';
  END IF;

  INSERT INTO public.restaurant_external_profile_snapshots (
    external_profile_id,
    snapshot_type,
    source_revision,
    payload,
    payload_hash
  )
  VALUES (
    p_external_profile_id,
    'location',
    p_location_source_revision,
    p_location_snapshot,
    p_location_payload_hash
  );

  IF p_attributes_snapshot IS NOT NULL THEN
    INSERT INTO public.restaurant_external_profile_snapshots (
      external_profile_id,
      snapshot_type,
      source_revision,
      payload,
      payload_hash
    )
    VALUES (
      p_external_profile_id,
      'attributes',
      p_attributes_source_revision,
      p_attributes_snapshot,
      p_attributes_payload_hash
    );
  END IF;

  IF p_business_details IS NULL THEN
    DELETE FROM public.restaurant_business_details
    WHERE restaurant_id = p_restaurant_id
      AND source = 'gbp'
      AND managed_by = 'gbp';
  ELSE
    INSERT INTO public.restaurant_business_details (
      id,
      restaurant_id,
      business_name,
      description,
      language_code,
      opening_date,
      business_status,
      is_service_area_business,
      can_reopen,
      source,
      source_record_id,
      managed_by,
      last_synced_at,
      change_origin,
      changed_via,
      change_reason
    )
    SELECT
      COALESCE(row.id, gen_random_uuid()),
      p_restaurant_id,
      row.business_name,
      row.description,
      row.language_code,
      row.opening_date,
      row.business_status,
      COALESCE(row.is_service_area_business, false),
      row.can_reopen,
      'gbp',
      row.source_record_id,
      'gbp',
      row.last_synced_at,
      COALESCE(row.change_origin, 'google'),
      COALESCE(row.changed_via, 'gbp_sync'),
      row.change_reason
    FROM jsonb_to_record(p_business_details) AS row(
      id uuid,
      business_name text,
      description text,
      language_code text,
      opening_date date,
      business_status text,
      is_service_area_business boolean,
      can_reopen boolean,
      source_record_id text,
      last_synced_at timestamptz,
      change_origin text,
      changed_via text,
      change_reason text
    )
    ON CONFLICT (restaurant_id, source, managed_by) DO UPDATE
    SET
      business_name = EXCLUDED.business_name,
      description = EXCLUDED.description,
      language_code = EXCLUDED.language_code,
      opening_date = EXCLUDED.opening_date,
      business_status = EXCLUDED.business_status,
      is_service_area_business = EXCLUDED.is_service_area_business,
      can_reopen = EXCLUDED.can_reopen,
      source_record_id = EXCLUDED.source_record_id,
      last_synced_at = EXCLUDED.last_synced_at,
      change_origin = EXCLUDED.change_origin,
      changed_via = EXCLUDED.changed_via,
      change_reason = EXCLUDED.change_reason,
      updated_at = timezone('utc', now());
  END IF;

  DELETE FROM public.restaurant_addresses
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

  INSERT INTO public.restaurant_addresses (
    id,
    restaurant_id,
    address_type,
    formatted_address,
    address_lines,
    locality,
    administrative_area,
    postal_code,
    region_code,
    country_code,
    language_code,
    sublocality,
    organization,
    sorting_code,
    recipients,
    latitude,
    longitude,
    latlng_json,
    is_primary,
    display_order,
    source,
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    COALESCE(row.address_type, 'storefront'),
    row.formatted_address,
    COALESCE(row.address_lines, '[]'::jsonb),
    row.locality,
    row.administrative_area,
    row.postal_code,
    row.region_code,
    row.country_code,
    row.language_code,
    row.sublocality,
    row.organization,
    row.sorting_code,
    COALESCE(row.recipients, '[]'::jsonb),
    row.latitude,
    row.longitude,
    COALESCE(row.latlng_json, '{}'::jsonb),
    COALESCE(row.is_primary, false),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_addresses, '[]'::jsonb)) AS row(
    id uuid,
    address_type text,
    formatted_address text,
    address_lines jsonb,
    locality text,
    administrative_area text,
    postal_code text,
    region_code text,
    country_code text,
    language_code text,
    sublocality text,
    organization text,
    sorting_code text,
    recipients jsonb,
    latitude numeric,
    longitude numeric,
    latlng_json jsonb,
    is_primary boolean,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  DELETE FROM public.restaurant_phone_numbers
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

  INSERT INTO public.restaurant_phone_numbers (
    id,
    restaurant_id,
    phone_kind,
    phone_number,
    is_primary,
    display_order,
    source,
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.phone_kind,
    row.phone_number,
    COALESCE(row.is_primary, false),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_phone_numbers, '[]'::jsonb)) AS row(
    id uuid,
    phone_kind text,
    phone_number text,
    is_primary boolean,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  DELETE FROM public.restaurant_links
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

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
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.link_type,
    COALESCE(row.link_status, 'current'),
    row.label,
    row.url,
    COALESCE(row.is_primary, false),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_links, '[]'::jsonb)) AS row(
    id uuid,
    link_type text,
    link_status text,
    label text,
    url text,
    is_primary boolean,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  DELETE FROM public.restaurant_categories
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

  INSERT INTO public.restaurant_categories (
    id,
    restaurant_id,
    display_name,
    category_code,
    more_hours_types_json,
    is_primary,
    display_order,
    source,
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.display_name,
    row.category_code,
    COALESCE(row.more_hours_types_json, '[]'::jsonb),
    COALESCE(row.is_primary, false),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_categories, '[]'::jsonb)) AS row(
    id uuid,
    display_name text,
    category_code text,
    more_hours_types_json jsonb,
    is_primary boolean,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  DELETE FROM public.restaurant_service_areas
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

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
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.display_name,
    COALESCE(row.area_type, 'place'),
    row.region_code,
    row.google_place_id,
    row.google_place_resource_name,
    COALESCE(row.place_data_json, '{}'::jsonb),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_service_areas, '[]'::jsonb)) AS row(
    id uuid,
    display_name text,
    area_type text,
    region_code text,
    google_place_id text,
    google_place_resource_name text,
    place_data_json jsonb,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  DELETE FROM public.restaurant_hours
  WHERE restaurant_id = p_restaurant_id
    AND source = 'gbp'
    AND managed_by = 'gbp';

  INSERT INTO public.restaurant_hours (
    id,
    restaurant_id,
    hours_type,
    period_code,
    period_label,
    open_day,
    close_day,
    start_date,
    end_date,
    open_time,
    close_time,
    is_closed,
    display_order,
    source,
    source_record_id,
    managed_by,
    last_synced_at,
    change_origin,
    changed_via,
    change_reason
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.hours_type,
    row.period_code,
    row.period_label,
    row.open_day,
    row.close_day,
    row.start_date,
    row.end_date,
    row.open_time,
    row.close_time,
    COALESCE(row.is_closed, false),
    COALESCE(row.display_order, 0),
    'gbp',
    row.source_record_id,
    'gbp',
    row.last_synced_at,
    COALESCE(row.change_origin, 'google'),
    COALESCE(row.changed_via, 'gbp_sync'),
    row.change_reason
  FROM jsonb_to_recordset(COALESCE(p_hours, '[]'::jsonb)) AS row(
    id uuid,
    hours_type text,
    period_code text,
    period_label text,
    open_day integer,
    close_day integer,
    start_date date,
    end_date date,
    open_time time,
    close_time time,
    is_closed boolean,
    display_order integer,
    source_record_id text,
    last_synced_at timestamptz,
    change_origin text,
    changed_via text,
    change_reason text
  );

  IF p_attributes IS NOT NULL THEN
    DELETE FROM public.restaurant_attributes
    WHERE restaurant_id = p_restaurant_id
      AND source = 'gbp'
      AND managed_by = 'gbp';

    INSERT INTO public.restaurant_attributes (
      id,
      restaurant_id,
      attribute_group,
      attribute_key,
      attribute_name,
      attribute_id,
      attribute_definition_id,
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
      source_record_id,
      managed_by,
      last_synced_at,
      change_origin,
      changed_via,
      change_reason
    )
    SELECT
      COALESCE(row.id, gen_random_uuid()),
      p_restaurant_id,
      row.attribute_group,
      row.attribute_key,
      row.attribute_name,
      row.attribute_id,
      row.attribute_definition_id,
      row.display_name,
      row.display_text,
      row.display_text_standalone,
      row.display_text_negative,
      row.value_type,
      row.bool_value,
      row.text_value,
      row.uri_value,
      COALESCE(row.uri_values, '[]'::jsonb),
      COALESCE(row.enum_values, '[]'::jsonb),
      COALESCE(row.unset_enum_values, '[]'::jsonb),
      COALESCE(row.raw_value_json, '{}'::jsonb),
      COALESCE(row.raw_enum_values_json, '{}'::jsonb),
      COALESCE(row.display_value_json, '{}'::jsonb),
      COALESCE(row.value_metadata_json, '[]'::jsonb),
      COALESCE(row.display_order, 0),
      'gbp',
      row.source_record_id,
      'gbp',
      row.last_synced_at,
      COALESCE(row.change_origin, 'google'),
      COALESCE(row.changed_via, 'gbp_sync'),
      row.change_reason
    FROM jsonb_to_recordset(COALESCE(p_attributes, '[]'::jsonb)) AS row(
      id uuid,
      attribute_group text,
      attribute_key text,
      attribute_name text,
      attribute_id text,
      attribute_definition_id uuid,
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
      source_record_id text,
      last_synced_at timestamptz,
      change_origin text,
      changed_via text,
      change_reason text
    );
  END IF;

  IF p_service_items IS NOT NULL THEN
    DELETE FROM public.restaurant_service_items
    WHERE restaurant_id = p_restaurant_id
      AND source = 'gbp'
      AND managed_by = 'gbp';

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
      source_record_id,
      managed_by,
      last_synced_at,
      change_origin,
      changed_via,
      change_reason
    )
    SELECT
      COALESCE(row.id, gen_random_uuid()),
      p_restaurant_id,
      row.item_key,
      row.item_type,
      row.display_name,
      row.description,
      COALESCE(row.payload_json, '{}'::jsonb),
      COALESCE(row.display_order, 0),
      'gbp',
      row.source_record_id,
      'gbp',
      row.last_synced_at,
      COALESCE(row.change_origin, 'google'),
      COALESCE(row.changed_via, 'gbp_sync'),
      row.change_reason
    FROM jsonb_to_recordset(COALESCE(p_service_items, '[]'::jsonb)) AS row(
      id uuid,
      item_key text,
      item_type text,
      display_name text,
      description text,
      payload_json jsonb,
      display_order integer,
      source_record_id text,
      last_synced_at timestamptz,
      change_origin text,
      changed_via text,
      change_reason text
    );
  END IF;

  IF array_length(p_field_sync_entity_tables, 1) > 0 THEN
    DELETE FROM public.restaurant_field_sync_statuses
    WHERE restaurant_id = p_restaurant_id
      AND provider = 'gbp'
      AND entity_table = ANY(p_field_sync_entity_tables);
  END IF;

  INSERT INTO public.restaurant_field_sync_statuses (
    id,
    restaurant_id,
    provider,
    entity_table,
    entity_key,
    field_key,
    provider_record_id,
    sync_status,
    is_verified,
    verified_at,
    verified_by,
    last_provider_value_json,
    last_canonical_value_json,
    value_hash,
    last_synced_at,
    last_checked_at
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    'gbp',
    row.entity_table,
    row.entity_key,
    row.field_key,
    row.provider_record_id,
    COALESCE(row.sync_status, 'synced'),
    COALESCE(row.is_verified, true),
    row.verified_at,
    COALESCE(row.verified_by, 'gbp_sync'),
    row.last_provider_value_json,
    row.last_canonical_value_json,
    row.value_hash,
    row.last_synced_at,
    row.last_checked_at
  FROM jsonb_to_recordset(COALESCE(p_field_sync_statuses, '[]'::jsonb)) AS row(
    id uuid,
    entity_table text,
    entity_key text,
    field_key text,
    provider_record_id text,
    sync_status text,
    is_verified boolean,
    verified_at timestamptz,
    verified_by text,
    last_provider_value_json jsonb,
    last_canonical_value_json jsonb,
    value_hash text,
    last_synced_at timestamptz,
    last_checked_at timestamptz
  );

  INSERT INTO public.restaurant_profile_change_log (
    id,
    restaurant_id,
    entity_table,
    entity_id,
    field_path,
    old_value,
    new_value,
    change_origin,
    changed_by_user_id,
    changed_via,
    change_reason,
    external_profile_id,
    external_provider,
    external_sync_run_id,
    decision_id,
    draft_id,
    publish_job_id,
    publish_event_id,
    status,
    valid_from,
    valid_to,
    detected_at,
    applied_at,
    metadata
  )
  SELECT
    COALESCE(row.id, gen_random_uuid()),
    p_restaurant_id,
    row.entity_table,
    row.entity_id,
    row.field_path,
    row.old_value,
    row.new_value,
    row.change_origin,
    row.changed_by_user_id,
    row.changed_via,
    row.change_reason,
    p_external_profile_id,
    COALESCE(row.external_provider, 'google_business_profile'),
    row.external_sync_run_id,
    row.decision_id,
    row.draft_id,
    row.publish_job_id,
    row.publish_event_id,
    COALESCE(row.status, 'applied'),
    row.valid_from,
    row.valid_to,
    COALESCE(row.detected_at, timezone('utc', now())),
    row.applied_at,
    COALESCE(row.metadata, '{}'::jsonb)
  FROM jsonb_to_recordset(COALESCE(p_profile_change_log_rows, '[]'::jsonb)) AS row(
    id uuid,
    entity_table text,
    entity_id uuid,
    field_path text,
    old_value jsonb,
    new_value jsonb,
    change_origin text,
    changed_by_user_id uuid,
    changed_via text,
    change_reason text,
    external_provider text,
    external_sync_run_id uuid,
    decision_id uuid,
    draft_id uuid,
    publish_job_id uuid,
    publish_event_id uuid,
    status text,
    valid_from timestamptz,
    valid_to timestamptz,
    detected_at timestamptz,
    applied_at timestamptz,
    metadata jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_gbp_canonical_business_info(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text[],
  jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_gbp_canonical_business_info(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text[],
  jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_gbp_canonical_business_info(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text[],
  jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_gbp_canonical_business_info(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text[],
  jsonb
) TO service_role;

