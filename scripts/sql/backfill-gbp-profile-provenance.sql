BEGIN;

WITH service_area_place_ids AS (
  SELECT
    id,
    NULLIF(
      COALESCE(
        place_data_json ->> 'place_id',
        place_data_json ->> 'placeId',
        place_data_json #>> '{place,place_id}',
        place_data_json #>> '{place,placeId}',
        place_data_json #>> '{place,metadata,placeId}',
        place_data_json #>> '{metadata,placeId}',
        CASE
          WHEN COALESCE(
            place_data_json ->> 'name',
            place_data_json ->> 'resourceName',
            place_data_json #>> '{place,name}',
            place_data_json #>> '{place,resourceName}'
          ) ~ '^places/[^/]+$'
          THEN split_part(
            COALESCE(
              place_data_json ->> 'name',
              place_data_json ->> 'resourceName',
              place_data_json #>> '{place,name}',
              place_data_json #>> '{place,resourceName}'
            ),
            '/',
            2
          )
          ELSE NULL
        END
      ),
      ''
    ) AS google_place_id,
    NULLIF(
      COALESCE(
        place_data_json ->> 'resourceName',
        place_data_json ->> 'name',
        place_data_json #>> '{place,resourceName}',
        place_data_json #>> '{place,name}',
        CASE
          WHEN COALESCE(place_data_json ->> 'placeId', place_data_json ->> 'place_id') IS NOT NULL
          THEN 'places/' || COALESCE(place_data_json ->> 'placeId', place_data_json ->> 'place_id')
          ELSE NULL
        END
      ),
      ''
    ) AS google_place_resource_name
  FROM public.restaurant_service_areas
)
UPDATE public.restaurant_service_areas target
SET
  google_place_id = COALESCE(target.google_place_id, source.google_place_id),
  google_place_resource_name = COALESCE(
    target.google_place_resource_name,
    source.google_place_resource_name
  )
FROM service_area_place_ids source
WHERE target.id = source.id
  AND (
    target.google_place_id IS NULL
    OR target.google_place_resource_name IS NULL
  )
  AND (
    source.google_place_id IS NOT NULL
    OR source.google_place_resource_name IS NOT NULL
  );

DO $$
DECLARE
  canonical_table text;
BEGIN
  FOREACH canonical_table IN ARRAY ARRAY[
    'restaurant_business_details',
    'restaurant_addresses',
    'restaurant_phone_numbers',
    'restaurant_links',
    'restaurant_categories',
    'restaurant_service_areas',
    'restaurant_hours',
    'restaurant_attributes',
    'restaurant_service_items'
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%I
       SET
         change_origin = CASE
           WHEN source = ''gbp'' OR managed_by = ''gbp'' THEN ''google''
           WHEN source = ''nabatable'' OR managed_by = ''nabatable'' THEN ''owner''
           WHEN source = ''derived'' THEN ''system''
           ELSE ''system''
         END,
         changed_via = COALESCE(changed_via, ''backfill:gbp_profile_provenance''),
         change_reason = COALESCE(
           change_reason,
           ''Backfilled from existing source and managed_by metadata.''
         )
       WHERE change_origin IS NULL',
      canonical_table
    );
  END LOOP;
END
$$;

INSERT INTO public.restaurant_attribute_definitions (
  provider,
  provider_attribute_id,
  attribute_key,
  display_name,
  group_name,
  expected_value_type,
  raw_definition_json,
  first_seen_at,
  last_seen_at
)
SELECT DISTINCT ON (attribute_key)
  'google_business_profile',
  COALESCE(NULLIF(attribute_id, ''), attribute_key),
  attribute_key,
  display_name,
  attribute_group,
  CASE value_type
    WHEN 'boolean' THEN 'boolean'
    WHEN 'enum' THEN 'enum'
    WHEN 'multienum' THEN 'repeated_enum'
    WHEN 'uri' THEN 'url'
    WHEN 'text' THEN 'text'
    ELSE 'json'
  END,
  jsonb_strip_nulls(
    jsonb_build_object(
      'attribute_name', attribute_name,
      'attribute_id', attribute_id,
      'display_text_standalone', display_text_standalone,
      'display_text_negative', display_text_negative,
      'value_metadata_json', value_metadata_json
    )
  ),
  COALESCE(created_at, timezone('utc', now())),
  COALESCE(last_synced_at, updated_at, timezone('utc', now()))
FROM public.restaurant_attributes source_attribute
WHERE source = 'gbp'
  AND attribute_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.restaurant_attribute_definitions existing
    WHERE existing.provider = 'google_business_profile'
      AND existing.attribute_key = source_attribute.attribute_key
  )
ORDER BY attribute_key, updated_at DESC;

UPDATE public.restaurant_attributes attribute
SET attribute_definition_id = definition.id
FROM public.restaurant_attribute_definitions definition
WHERE attribute.attribute_definition_id IS NULL
  AND definition.provider = 'google_business_profile'
  AND (
    definition.attribute_key = attribute.attribute_key
    OR (
      attribute.attribute_id IS NOT NULL
      AND definition.provider_attribute_id = attribute.attribute_id
    )
  );

COMMIT;
