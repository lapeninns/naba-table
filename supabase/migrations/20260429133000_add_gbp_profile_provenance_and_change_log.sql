BEGIN;

ALTER TABLE public.restaurant_service_areas
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_place_resource_name text;

CREATE INDEX IF NOT EXISTS restaurant_service_areas_google_place_id_idx
  ON public.restaurant_service_areas (google_place_id);

CREATE INDEX IF NOT EXISTS restaurant_service_areas_restaurant_google_place_id_idx
  ON public.restaurant_service_areas (restaurant_id, google_place_id);

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
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS change_origin text,
         ADD COLUMN IF NOT EXISTS changed_by_user_id uuid,
         ADD COLUMN IF NOT EXISTS changed_via text,
         ADD COLUMN IF NOT EXISTS change_reason text',
      canonical_table
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = canonical_table || '_change_origin_check'
        AND conrelid = format('public.%I', canonical_table)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I
           ADD CONSTRAINT %I
           CHECK (
             change_origin IS NULL
             OR change_origin IN (''google'', ''owner'', ''api'', ''suggestion'', ''system'', ''import'')
           )',
        canonical_table,
        canonical_table || '_change_origin_check'
      );
    END IF;
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS public.restaurant_attribute_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'google_business_profile',
  provider_attribute_id text,
  attribute_key text NOT NULL,
  display_name text,
  group_name text,
  expected_value_type text NOT NULL DEFAULT 'json',
  allowed_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  country_code text,
  category_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_deprecated boolean NOT NULL DEFAULT false,
  raw_definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_attribute_definitions_value_type_check
    CHECK (
      expected_value_type IN (
        'boolean',
        'enum',
        'repeated_enum',
        'url',
        'text',
        'number',
        'json'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_attribute_definitions_provider_attribute_id_idx
  ON public.restaurant_attribute_definitions (provider, provider_attribute_id)
  WHERE provider_attribute_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS restaurant_attribute_definitions_attribute_key_idx
  ON public.restaurant_attribute_definitions (attribute_key);

CREATE INDEX IF NOT EXISTS restaurant_attribute_definitions_provider_attribute_key_idx
  ON public.restaurant_attribute_definitions (provider, attribute_key);

CREATE INDEX IF NOT EXISTS restaurant_attribute_definitions_group_name_idx
  ON public.restaurant_attribute_definitions (group_name);

CREATE INDEX IF NOT EXISTS restaurant_attribute_definitions_country_code_idx
  ON public.restaurant_attribute_definitions (country_code);

CREATE INDEX IF NOT EXISTS restaurant_attribute_definitions_category_ids_idx
  ON public.restaurant_attribute_definitions USING gin (category_ids);

DROP TRIGGER IF EXISTS restaurant_attribute_definitions_updated_at
ON public.restaurant_attribute_definitions;

CREATE TRIGGER restaurant_attribute_definitions_updated_at
  BEFORE UPDATE ON public.restaurant_attribute_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_attributes
  ADD COLUMN IF NOT EXISTS attribute_definition_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_attributes_attribute_definition_id_fkey'
      AND conrelid = 'public.restaurant_attributes'::regclass
  ) THEN
    ALTER TABLE public.restaurant_attributes
      ADD CONSTRAINT restaurant_attributes_attribute_definition_id_fkey
      FOREIGN KEY (attribute_definition_id)
      REFERENCES public.restaurant_attribute_definitions(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS restaurant_attributes_attribute_definition_id_idx
  ON public.restaurant_attributes (attribute_definition_id);

CREATE TABLE IF NOT EXISTS public.restaurant_profile_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  entity_table text NOT NULL,
  entity_id uuid,
  field_path text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_origin text,
  changed_by_user_id uuid,
  changed_via text,
  change_reason text,
  external_profile_id uuid REFERENCES public.restaurant_external_profiles(id) ON DELETE SET NULL,
  external_provider text,
  external_sync_run_id uuid REFERENCES public.restaurant_external_profile_sync_runs(id) ON DELETE SET NULL,
  decision_id uuid,
  draft_id uuid,
  publish_job_id uuid,
  publish_event_id uuid,
  status text NOT NULL DEFAULT 'applied',
  valid_from timestamptz,
  valid_to timestamptz,
  detected_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  applied_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_profile_change_log_origin_check
    CHECK (
      change_origin IS NULL
      OR change_origin IN ('google', 'owner', 'api', 'suggestion', 'system', 'import')
    ),
  CONSTRAINT restaurant_profile_change_log_status_check
    CHECK (
      status IN (
        'detected',
        'proposed',
        'accepted',
        'rejected',
        'applied',
        'failed',
        'reverted'
      )
    )
);

CREATE INDEX IF NOT EXISTS restaurant_profile_change_log_restaurant_created_idx
  ON public.restaurant_profile_change_log (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_profile_change_log_entity_field_idx
  ON public.restaurant_profile_change_log (entity_table, entity_id, field_path);

CREATE INDEX IF NOT EXISTS restaurant_profile_change_log_change_origin_idx
  ON public.restaurant_profile_change_log (change_origin);

CREATE INDEX IF NOT EXISTS restaurant_profile_change_log_status_idx
  ON public.restaurant_profile_change_log (status);

CREATE INDEX IF NOT EXISTS restaurant_profile_change_log_metadata_idx
  ON public.restaurant_profile_change_log USING gin (metadata);

DROP TRIGGER IF EXISTS restaurant_profile_change_log_updated_at
ON public.restaurant_profile_change_log;

CREATE TRIGGER restaurant_profile_change_log_updated_at
  BEFORE UPDATE ON public.restaurant_profile_change_log
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_profile_change_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_attribute_definitions'
      AND policyname = 'Service role can manage restaurant attribute definitions'
  ) THEN
    CREATE POLICY "Service role can manage restaurant attribute definitions"
      ON public.restaurant_attribute_definitions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_profile_change_log'
      AND policyname = 'Service role can manage restaurant profile change log'
  ) THEN
    CREATE POLICY "Service role can manage restaurant profile change log"
      ON public.restaurant_profile_change_log
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON COLUMN public.restaurant_service_areas.google_place_id IS
  'First-class Google Place ID extracted from GBP service-area place payloads.';
COMMENT ON COLUMN public.restaurant_service_areas.google_place_resource_name IS
  'Google place resource name, usually places/{place_id}, extracted from GBP service-area place payloads.';
COMMENT ON TABLE public.restaurant_attribute_definitions IS
  'Provider attribute definition dictionary for GBP and future external profile metadata.';
COMMENT ON COLUMN public.restaurant_attributes.attribute_definition_id IS
  'Optional link from flexible restaurant attributes to provider attribute definitions.';
COMMENT ON TABLE public.restaurant_profile_change_log IS
  'Unified field-level profile change log for canonical restaurant profile mutations across sync, owner edit, draft, and publish flows.';

COMMIT;
