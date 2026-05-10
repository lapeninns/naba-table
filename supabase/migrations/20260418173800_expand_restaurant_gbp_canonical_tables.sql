ALTER TABLE public.restaurant_business_details
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS can_reopen boolean;

ALTER TABLE public.restaurant_categories
  ADD COLUMN IF NOT EXISTS more_hours_types_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.restaurant_service_areas
  ADD COLUMN IF NOT EXISTS place_data_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.restaurant_hours
  ADD COLUMN IF NOT EXISTS period_code text;

ALTER TABLE public.restaurant_attributes
  ADD COLUMN IF NOT EXISTS attribute_name text,
  ADD COLUMN IF NOT EXISTS attribute_id text,
  ADD COLUMN IF NOT EXISTS uri_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unset_enum_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS value_metadata_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS display_text_standalone text,
  ADD COLUMN IF NOT EXISTS display_text_negative text;

CREATE TABLE IF NOT EXISTS public.restaurant_service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text,
  display_name text,
  description text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_service_items_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_service_items_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed')),
  CONSTRAINT restaurant_service_items_unique
    UNIQUE (restaurant_id, item_key, source, managed_by)
);

CREATE INDEX IF NOT EXISTS restaurant_service_items_lookup_idx
  ON public.restaurant_service_items (restaurant_id, display_order);

DROP TRIGGER IF EXISTS restaurant_service_items_updated_at
ON public.restaurant_service_items;

CREATE TRIGGER restaurant_service_items_updated_at
  BEFORE UPDATE ON public.restaurant_service_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_service_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_service_items'
      AND policyname = 'Service role can manage restaurant service items'
  ) THEN
    CREATE POLICY "Service role can manage restaurant service items"
      ON public.restaurant_service_items
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON COLUMN public.restaurant_business_details.business_name IS 'Provider-sourced business title/name retained separately from the app-facing restaurants.name projection.';
COMMENT ON COLUMN public.restaurant_business_details.language_code IS 'Primary GBP language code for the linked location profile.';
COMMENT ON COLUMN public.restaurant_business_details.can_reopen IS 'GBP openInfo.canReopen flag when provided by Google.';
COMMENT ON COLUMN public.restaurant_categories.more_hours_types_json IS 'GBP category-supported more-hours type definitions retained as canonical JSON for future sync and UI workflows.';
COMMENT ON COLUMN public.restaurant_service_areas.place_data_json IS 'Structured GBP place/service-area payload retained alongside the canonical display_name.';
COMMENT ON COLUMN public.restaurant_hours.period_code IS 'Raw GBP moreHours hoursTypeId or other upstream period identifier backing period_label.';
COMMENT ON COLUMN public.restaurant_attributes.attribute_name IS 'Raw GBP attribute resource name when provided.';
COMMENT ON COLUMN public.restaurant_attributes.attribute_id IS 'Raw GBP attributeId when provided.';
COMMENT ON COLUMN public.restaurant_attributes.uri_values IS 'All GBP URI values retained as canonical JSON, not just the first URI.';
COMMENT ON COLUMN public.restaurant_attributes.unset_enum_values IS 'GBP repeated-enum unset values retained for future CRUD and sync-aware UI.';
COMMENT ON COLUMN public.restaurant_attributes.value_metadata_json IS 'GBP attribute value metadata retained in canonical storage.';
COMMENT ON COLUMN public.restaurant_attributes.display_text_standalone IS 'GBP standalone display string for the attribute.';
COMMENT ON COLUMN public.restaurant_attributes.display_text_negative IS 'GBP negative display string for the attribute.';
COMMENT ON TABLE public.restaurant_service_items IS 'Canonical restaurant service items retained from GBP and future integrations for CRUD-aware UI and selective sync.';
