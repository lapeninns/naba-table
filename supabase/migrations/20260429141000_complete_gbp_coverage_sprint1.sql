BEGIN;

ALTER TABLE public.restaurant_phone_numbers
  DROP CONSTRAINT IF EXISTS restaurant_phone_numbers_kind_check;

ALTER TABLE public.restaurant_phone_numbers
  ADD CONSTRAINT restaurant_phone_numbers_kind_check
  CHECK (
    phone_kind IN (
      'primary',
      'additional',
      'reservations',
      'support',
      'whatsapp',
      'fax',
      'other'
    )
  );

ALTER TABLE public.restaurant_addresses
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

UPDATE public.restaurant_addresses
SET
  latitude = COALESCE(
    latitude,
    CASE
      WHEN latlng_json ->> 'latitude' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (latlng_json ->> 'latitude')::numeric
      ELSE NULL
    END
  ),
  longitude = COALESCE(
    longitude,
    CASE
      WHEN latlng_json ->> 'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (latlng_json ->> 'longitude')::numeric
      ELSE NULL
    END
  )
WHERE latlng_json IS NOT NULL
  AND latlng_json <> '{}'::jsonb
  AND (latitude IS NULL OR longitude IS NULL);

ALTER TABLE public.restaurant_attributes
  ADD COLUMN IF NOT EXISTS raw_value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_enum_values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS display_value_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.restaurant_attributes
SET
  raw_enum_values_json = CASE
    WHEN raw_enum_values_json = '{}'::jsonb
    THEN jsonb_strip_nulls(
      jsonb_build_object(
        'setValues',
        COALESCE(enum_values, '[]'::jsonb),
        'unsetValues',
        COALESCE(unset_enum_values, '[]'::jsonb)
      )
    )
    ELSE raw_enum_values_json
  END,
  display_value_json = CASE
    WHEN display_value_json = '{}'::jsonb
    THEN jsonb_strip_nulls(
      jsonb_build_object(
        'displayName',
        display_name,
        'displayText',
        display_text,
        'standaloneText',
        display_text_standalone,
        'negativeText',
        display_text_negative,
        'valueMetadata',
        value_metadata_json
      )
    )
    ELSE display_value_json
  END;

ALTER TABLE public.restaurant_external_profiles
  ADD COLUMN IF NOT EXISTS provider_timezone text;

ALTER TABLE public.restaurant_service_areas
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_place_resource_name text;

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

CREATE INDEX IF NOT EXISTS restaurant_service_areas_google_place_id_idx
  ON public.restaurant_service_areas (google_place_id);

CREATE INDEX IF NOT EXISTS restaurant_service_areas_restaurant_google_place_id_idx
  ON public.restaurant_service_areas (restaurant_id, google_place_id);

CREATE OR REPLACE VIEW public.restaurant_gbp_service_area_place_id_gaps AS
SELECT
  id,
  restaurant_id,
  display_name,
  region_code,
  google_place_id,
  google_place_resource_name,
  place_data_json,
  last_synced_at,
  updated_at
FROM public.restaurant_service_areas
WHERE source = 'gbp'
  AND google_place_id IS NULL
  AND (
    place_data_json ? 'placeId'
    OR place_data_json ? 'place_id'
    OR place_data_json #>> '{place,placeId}' IS NOT NULL
    OR place_data_json #>> '{place,place_id}' IS NOT NULL
    OR place_data_json #>> '{metadata,placeId}' IS NOT NULL
    OR place_data_json #>> '{place,metadata,placeId}' IS NOT NULL
    OR COALESCE(
      place_data_json ->> 'name',
      place_data_json ->> 'resourceName',
      place_data_json #>> '{place,name}',
      place_data_json #>> '{place,resourceName}'
    ) ~ '^places/[^/]+$'
  );

COMMENT ON CONSTRAINT restaurant_phone_numbers_kind_check
ON public.restaurant_phone_numbers
IS 'Allows GBP primary and additional phones plus Nabatable-specific phone kinds.';

COMMENT ON COLUMN public.restaurant_addresses.latitude IS
  'First-class latitude extracted from GBP latlng_json while preserving the raw payload.';
COMMENT ON COLUMN public.restaurant_addresses.longitude IS
  'First-class longitude extracted from GBP latlng_json while preserving the raw payload.';
COMMENT ON COLUMN public.restaurant_attributes.raw_value_json IS
  'Raw provider attribute value payload used for forward-compatible GBP round trips.';
COMMENT ON COLUMN public.restaurant_attributes.raw_enum_values_json IS
  'Raw GBP enum IDs, including repeated enum set/unset values, kept separate from labels.';
COMMENT ON COLUMN public.restaurant_attributes.display_value_json IS
  'Human-friendly provider labels and display strings for attribute values.';
COMMENT ON COLUMN public.restaurant_external_profiles.provider_timezone IS
  'Provider-reported timezone for the linked external business profile, stored separately from restaurants.timezone.';
COMMENT ON VIEW public.restaurant_gbp_service_area_place_id_gaps IS
  'Validation view for GBP service areas whose raw place payload contains a Google Place ID but google_place_id is missing.';

COMMIT;
