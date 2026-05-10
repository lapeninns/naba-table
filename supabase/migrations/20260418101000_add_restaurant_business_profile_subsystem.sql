BEGIN;

CREATE OR REPLACE FUNCTION public.touch_restaurant_business_entity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_address_projection(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.restaurants
  SET address = projected.formatted_address
  FROM (
    SELECT a.formatted_address
    FROM public.restaurant_addresses a
    WHERE a.restaurant_id = p_restaurant_id
    ORDER BY a.is_primary DESC, a.display_order ASC, a.created_at ASC
    LIMIT 1
  ) AS projected
  WHERE restaurants.id = p_restaurant_id;

  IF NOT FOUND THEN
    UPDATE public.restaurants
    SET address = NULL
    WHERE id = p_restaurant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_phone_projection(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.restaurants
  SET contact_phone = projected.phone_number
  FROM (
    SELECT p.phone_number
    FROM public.restaurant_phone_numbers p
    WHERE p.restaurant_id = p_restaurant_id
    ORDER BY p.is_primary DESC, p.display_order ASC, p.created_at ASC
    LIMIT 1
  ) AS projected
  WHERE restaurants.id = p_restaurant_id;

  IF NOT FOUND THEN
    UPDATE public.restaurants
    SET contact_phone = NULL
    WHERE id = p_restaurant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_link_projections(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_google_map_url text;
  v_google_review_url text;
BEGIN
  SELECT l.url
  INTO v_google_map_url
  FROM public.restaurant_links l
  WHERE l.restaurant_id = p_restaurant_id
    AND l.link_type = 'google_map'
    AND l.link_status = 'current'
  ORDER BY l.is_primary DESC, l.display_order ASC, l.created_at ASC
  LIMIT 1;

  SELECT l.url
  INTO v_google_review_url
  FROM public.restaurant_links l
  WHERE l.restaurant_id = p_restaurant_id
    AND l.link_type = 'google_review'
    AND l.link_status = 'current'
  ORDER BY l.is_primary DESC, l.display_order ASC, l.created_at ASC
  LIMIT 1;

  UPDATE public.restaurants
  SET google_map_url = v_google_map_url,
      google_review_url = v_google_review_url
  WHERE id = p_restaurant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_address_projection_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_restaurant_address_projection(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.restaurant_id ELSE NEW.restaurant_id END
  );

  IF TG_OP = 'UPDATE' AND OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id THEN
    PERFORM public.sync_restaurant_address_projection(OLD.restaurant_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_phone_projection_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_restaurant_phone_projection(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.restaurant_id ELSE NEW.restaurant_id END
  );

  IF TG_OP = 'UPDATE' AND OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id THEN
    PERFORM public.sync_restaurant_phone_projection(OLD.restaurant_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_link_projections_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_restaurant_link_projections(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.restaurant_id ELSE NEW.restaurant_id END
  );

  IF TG_OP = 'UPDATE' AND OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id THEN
    PERFORM public.sync_restaurant_link_projections(OLD.restaurant_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TABLE IF NOT EXISTS public.restaurant_business_details (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  description text,
  opening_date date,
  business_status text,
  is_service_area_business boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_business_details_business_status_check
    CHECK (
      business_status IS NULL
      OR business_status IN ('open', 'closed_permanently', 'closed_temporarily')
    ),
  CONSTRAINT restaurant_business_details_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_business_details_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed'))
);

CREATE TABLE IF NOT EXISTS public.restaurant_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  address_type text NOT NULL DEFAULT 'storefront',
  formatted_address text,
  address_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  locality text,
  administrative_area text,
  postal_code text,
  region_code text,
  country_code text,
  language_code text,
  sublocality text,
  organization text,
  sorting_code text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  latlng_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_addresses_type_check
    CHECK (address_type IN ('storefront', 'mailing', 'billing', 'service_area_anchor', 'other')),
  CONSTRAINT restaurant_addresses_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_addresses_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_addresses_primary_unique
  ON public.restaurant_addresses (restaurant_id)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.restaurant_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone_kind text NOT NULL DEFAULT 'primary',
  phone_number text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_phone_numbers_kind_check
    CHECK (phone_kind IN ('primary', 'reservations', 'support', 'whatsapp', 'fax', 'other')),
  CONSTRAINT restaurant_phone_numbers_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_phone_numbers_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed')),
  CONSTRAINT restaurant_phone_numbers_unique
    UNIQUE (restaurant_id, phone_kind, phone_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_phone_numbers_primary_unique
  ON public.restaurant_phone_numbers (restaurant_id)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.restaurant_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  link_status text NOT NULL DEFAULT 'current',
  label text,
  url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_links_type_check
    CHECK (
      link_type IN (
        'website',
        'menu_or_services',
        'reservation',
        'order',
        'chat',
        'google_map',
        'google_review',
        'facebook',
        'instagram',
        'x',
        'youtube',
        'tiktok',
        'linkedin',
        'other'
      )
    ),
  CONSTRAINT restaurant_links_status_check
    CHECK (link_status IN ('current', 'previous')),
  CONSTRAINT restaurant_links_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_links_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed')),
  CONSTRAINT restaurant_links_unique
    UNIQUE (restaurant_id, link_type, url, link_status)
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_links_primary_unique
  ON public.restaurant_links (restaurant_id, link_type, link_status)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.restaurant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_code text,
  display_name text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_categories_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_categories_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_categories_primary_unique
  ON public.restaurant_categories (restaurant_id)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.restaurant_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  area_type text NOT NULL DEFAULT 'place',
  display_name text NOT NULL,
  region_code text,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_service_areas_type_check
    CHECK (area_type IN ('place', 'region', 'postal_code', 'other')),
  CONSTRAINT restaurant_service_areas_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_service_areas_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed'))
);

CREATE TABLE IF NOT EXISTS public.restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  hours_type text NOT NULL,
  period_label text,
  open_day integer,
  close_day integer,
  start_date date,
  end_date date,
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_hours_type_check
    CHECK (hours_type IN ('public', 'operational', 'special', 'holiday', 'service')),
  CONSTRAINT restaurant_hours_open_day_check
    CHECK (open_day IS NULL OR open_day BETWEEN 0 AND 6),
  CONSTRAINT restaurant_hours_close_day_check
    CHECK (close_day IS NULL OR close_day BETWEEN 0 AND 6),
  CONSTRAINT restaurant_hours_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_hours_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed'))
);

CREATE TABLE IF NOT EXISTS public.restaurant_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  attribute_group text,
  attribute_key text NOT NULL,
  display_name text,
  value_type text NOT NULL,
  bool_value boolean,
  text_value text,
  uri_value text,
  enum_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_text text,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'nabatable',
  source_record_id text,
  managed_by text NOT NULL DEFAULT 'nabatable',
  last_synced_at timestamptz,
  last_manual_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_attributes_value_type_check
    CHECK (value_type IN ('boolean', 'text', 'uri', 'enum', 'multienum')),
  CONSTRAINT restaurant_attributes_source_check
    CHECK (source IN ('gbp', 'nabatable', 'derived')),
  CONSTRAINT restaurant_attributes_managed_by_check
    CHECK (managed_by IN ('gbp', 'nabatable', 'mixed')),
  CONSTRAINT restaurant_attributes_unique
    UNIQUE (restaurant_id, attribute_key)
);

CREATE TABLE IF NOT EXISTS public.restaurant_external_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_account_id text,
  external_location_id text,
  external_resource_name text,
  external_place_id text,
  connection_status text NOT NULL DEFAULT 'unlinked',
  sync_enabled boolean NOT NULL DEFAULT true,
  pull_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  last_pull_at timestamptz,
  last_push_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profiles_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profiles_status_check
    CHECK (connection_status IN ('pending_auth', 'linked', 'unlinked', 'sync_error')),
  CONSTRAINT restaurant_external_profiles_restaurant_provider_unique
    UNIQUE (restaurant_id, provider),
  CONSTRAINT restaurant_external_profiles_provider_location_unique
    UNIQUE (provider, external_location_id)
);

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_profile_id uuid NOT NULL REFERENCES public.restaurant_external_profiles(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL,
  source_revision text,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_snapshots_type_check
    CHECK (snapshot_type IN ('location', 'attributes'))
);

CREATE INDEX IF NOT EXISTS restaurant_addresses_lookup_idx
  ON public.restaurant_addresses (restaurant_id, is_primary DESC, display_order);

CREATE INDEX IF NOT EXISTS restaurant_phone_numbers_lookup_idx
  ON public.restaurant_phone_numbers (restaurant_id, is_primary DESC, display_order);

CREATE INDEX IF NOT EXISTS restaurant_links_lookup_idx
  ON public.restaurant_links (restaurant_id, link_type, link_status, is_primary DESC, display_order);

CREATE INDEX IF NOT EXISTS restaurant_categories_lookup_idx
  ON public.restaurant_categories (restaurant_id, is_primary DESC, display_order);

CREATE INDEX IF NOT EXISTS restaurant_service_areas_lookup_idx
  ON public.restaurant_service_areas (restaurant_id, display_order);

CREATE INDEX IF NOT EXISTS restaurant_hours_lookup_idx
  ON public.restaurant_hours (restaurant_id, hours_type, start_date, open_day, display_order);

CREATE INDEX IF NOT EXISTS restaurant_attributes_lookup_idx
  ON public.restaurant_attributes (restaurant_id, attribute_group, display_order);

CREATE INDEX IF NOT EXISTS restaurant_external_profiles_restaurant_idx
  ON public.restaurant_external_profiles (restaurant_id, provider);

CREATE INDEX IF NOT EXISTS restaurant_external_profiles_location_idx
  ON public.restaurant_external_profiles (provider, external_location_id);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_snapshots_profile_type_idx
  ON public.restaurant_external_profile_snapshots (external_profile_id, snapshot_type, fetched_at DESC);

DROP TRIGGER IF EXISTS restaurant_business_details_updated_at
ON public.restaurant_business_details;

CREATE TRIGGER restaurant_business_details_updated_at
  BEFORE UPDATE ON public.restaurant_business_details
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_addresses_updated_at
ON public.restaurant_addresses;

CREATE TRIGGER restaurant_addresses_updated_at
  BEFORE UPDATE ON public.restaurant_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_phone_numbers_updated_at
ON public.restaurant_phone_numbers;

CREATE TRIGGER restaurant_phone_numbers_updated_at
  BEFORE UPDATE ON public.restaurant_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_links_updated_at
ON public.restaurant_links;

CREATE TRIGGER restaurant_links_updated_at
  BEFORE UPDATE ON public.restaurant_links
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_categories_updated_at
ON public.restaurant_categories;

CREATE TRIGGER restaurant_categories_updated_at
  BEFORE UPDATE ON public.restaurant_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_service_areas_updated_at
ON public.restaurant_service_areas;

CREATE TRIGGER restaurant_service_areas_updated_at
  BEFORE UPDATE ON public.restaurant_service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_hours_updated_at
ON public.restaurant_hours;

CREATE TRIGGER restaurant_hours_updated_at
  BEFORE UPDATE ON public.restaurant_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_attributes_updated_at
ON public.restaurant_attributes;

CREATE TRIGGER restaurant_attributes_updated_at
  BEFORE UPDATE ON public.restaurant_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_external_profiles_updated_at
ON public.restaurant_external_profiles;

CREATE TRIGGER restaurant_external_profiles_updated_at
  BEFORE UPDATE ON public.restaurant_external_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_addresses_projection_sync
ON public.restaurant_addresses;

CREATE TRIGGER restaurant_addresses_projection_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_restaurant_address_projection_trigger();

DROP TRIGGER IF EXISTS restaurant_phone_numbers_projection_sync
ON public.restaurant_phone_numbers;

CREATE TRIGGER restaurant_phone_numbers_projection_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_restaurant_phone_projection_trigger();

DROP TRIGGER IF EXISTS restaurant_links_projection_sync
ON public.restaurant_links;

CREATE TRIGGER restaurant_links_projection_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_links
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_restaurant_link_projections_trigger();

ALTER TABLE public.restaurant_business_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_external_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_external_profile_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_business_details'
      AND policyname = 'Service role can manage restaurant business details'
  ) THEN
    CREATE POLICY "Service role can manage restaurant business details"
      ON public.restaurant_business_details
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_addresses'
      AND policyname = 'Service role can manage restaurant addresses'
  ) THEN
    CREATE POLICY "Service role can manage restaurant addresses"
      ON public.restaurant_addresses
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_phone_numbers'
      AND policyname = 'Service role can manage restaurant phone numbers'
  ) THEN
    CREATE POLICY "Service role can manage restaurant phone numbers"
      ON public.restaurant_phone_numbers
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_links'
      AND policyname = 'Service role can manage restaurant links'
  ) THEN
    CREATE POLICY "Service role can manage restaurant links"
      ON public.restaurant_links
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_categories'
      AND policyname = 'Service role can manage restaurant categories'
  ) THEN
    CREATE POLICY "Service role can manage restaurant categories"
      ON public.restaurant_categories
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_service_areas'
      AND policyname = 'Service role can manage restaurant service areas'
  ) THEN
    CREATE POLICY "Service role can manage restaurant service areas"
      ON public.restaurant_service_areas
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_hours'
      AND policyname = 'Service role can manage restaurant hours'
  ) THEN
    CREATE POLICY "Service role can manage restaurant hours"
      ON public.restaurant_hours
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_attributes'
      AND policyname = 'Service role can manage restaurant attributes'
  ) THEN
    CREATE POLICY "Service role can manage restaurant attributes"
      ON public.restaurant_attributes
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profiles'
      AND policyname = 'Service role can manage restaurant external profiles'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profiles"
      ON public.restaurant_external_profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_snapshots'
      AND policyname = 'Service role can manage restaurant external profile snapshots'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile snapshots"
      ON public.restaurant_external_profile_snapshots
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.restaurant_business_details IS 'Canonical public business-profile details owned by Nabatable and optionally populated from external providers such as GBP.';
COMMENT ON TABLE public.restaurant_addresses IS 'Canonical restaurant addresses with provenance metadata and projection compatibility for the legacy restaurants.address field.';
COMMENT ON TABLE public.restaurant_phone_numbers IS 'Canonical restaurant phone numbers with provenance metadata and projection compatibility for the legacy restaurants.contact_phone field.';
COMMENT ON TABLE public.restaurant_links IS 'Canonical restaurant public links including website, menu, social, map, and review URLs with projection compatibility for legacy Google link fields.';
COMMENT ON TABLE public.restaurant_categories IS 'Canonical restaurant business categories independent of any single external provider.';
COMMENT ON TABLE public.restaurant_service_areas IS 'Canonical restaurant service areas independent of any single external provider.';
COMMENT ON TABLE public.restaurant_hours IS 'Canonical restaurant hours for public, service, special, holiday, and operational time windows.';
COMMENT ON TABLE public.restaurant_attributes IS 'Canonical restaurant business attributes such as accessibility, amenities, parking, payments, pets, and service options.';
COMMENT ON TABLE public.restaurant_external_profiles IS 'Provider integration metadata for external business-profile sources such as Google Business Profile.';
COMMENT ON TABLE public.restaurant_external_profile_snapshots IS 'Immutable raw payload snapshots fetched from external business-profile providers for audit, debugging, and re-import.';

COMMIT;
