-- Service areas missing first-class place IDs but having JSON place IDs.
SELECT *
FROM public.restaurant_service_areas
WHERE google_place_id IS NULL
  AND (
    place_data_json ? 'place_id'
    OR place_data_json ? 'placeId'
    OR (place_data_json #>> '{place,place_id}') IS NOT NULL
    OR (place_data_json #>> '{place,placeId}') IS NOT NULL
    OR (place_data_json #>> '{place,metadata,placeId}') IS NOT NULL
    OR (place_data_json #>> '{metadata,placeId}') IS NOT NULL
  );

-- Canonical rows missing provenance.
SELECT 'restaurant_business_details' AS table_name, COUNT(*) AS missing_count
FROM public.restaurant_business_details
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_addresses', COUNT(*)
FROM public.restaurant_addresses
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_phone_numbers', COUNT(*)
FROM public.restaurant_phone_numbers
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_links', COUNT(*)
FROM public.restaurant_links
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_categories', COUNT(*)
FROM public.restaurant_categories
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_service_areas', COUNT(*)
FROM public.restaurant_service_areas
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_hours', COUNT(*)
FROM public.restaurant_hours
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_attributes', COUNT(*)
FROM public.restaurant_attributes
WHERE change_origin IS NULL
UNION ALL
SELECT 'restaurant_service_items', COUNT(*)
FROM public.restaurant_service_items
WHERE change_origin IS NULL;

-- Attributes that could link to a definition but are still unlinked.
SELECT attribute.*
FROM public.restaurant_attributes attribute
WHERE attribute.attribute_definition_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurant_attribute_definitions definition
    WHERE definition.provider = 'google_business_profile'
      AND (
        definition.attribute_key = attribute.attribute_key
        OR (
          attribute.attribute_id IS NOT NULL
          AND definition.provider_attribute_id = attribute.attribute_id
        )
      )
  );

-- Recent profile changes.
SELECT *
FROM public.restaurant_profile_change_log
ORDER BY created_at DESC
LIMIT 50;
