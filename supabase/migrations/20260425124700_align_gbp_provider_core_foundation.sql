BEGIN;

ALTER TABLE public.restaurant_business_details
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.restaurant_business_details
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.restaurant_business_details
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.restaurant_business_details
  DROP CONSTRAINT IF EXISTS restaurant_business_details_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_business_details_pkey'
      AND conrelid = 'public.restaurant_business_details'::regclass
  ) THEN
    ALTER TABLE public.restaurant_business_details
      ADD CONSTRAINT restaurant_business_details_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_business_details_restaurant_source_managed_unique'
      AND conrelid = 'public.restaurant_business_details'::regclass
  ) THEN
    ALTER TABLE public.restaurant_business_details
      ADD CONSTRAINT restaurant_business_details_restaurant_source_managed_unique
      UNIQUE (restaurant_id, source, managed_by);
  END IF;
END
$$;

DROP INDEX IF EXISTS public.restaurant_addresses_primary_unique;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_addresses_primary_unique
  ON public.restaurant_addresses (restaurant_id, source, managed_by)
  WHERE is_primary = true;

ALTER TABLE public.restaurant_phone_numbers
  DROP CONSTRAINT IF EXISTS restaurant_phone_numbers_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_phone_numbers_unique'
      AND conrelid = 'public.restaurant_phone_numbers'::regclass
  ) THEN
    ALTER TABLE public.restaurant_phone_numbers
      ADD CONSTRAINT restaurant_phone_numbers_unique
      UNIQUE (restaurant_id, phone_kind, phone_number, source, managed_by);
  END IF;
END
$$;

DROP INDEX IF EXISTS public.restaurant_phone_numbers_primary_unique;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_phone_numbers_primary_unique
  ON public.restaurant_phone_numbers (restaurant_id, source, managed_by)
  WHERE is_primary = true;

ALTER TABLE public.restaurant_links
  DROP CONSTRAINT IF EXISTS restaurant_links_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_links_unique'
      AND conrelid = 'public.restaurant_links'::regclass
  ) THEN
    ALTER TABLE public.restaurant_links
      ADD CONSTRAINT restaurant_links_unique
      UNIQUE (restaurant_id, link_type, url, link_status, source, managed_by);
  END IF;
END
$$;

DROP INDEX IF EXISTS public.restaurant_links_primary_unique;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_links_primary_unique
  ON public.restaurant_links (restaurant_id, link_type, link_status, source, managed_by)
  WHERE is_primary = true;

DROP INDEX IF EXISTS public.restaurant_categories_primary_unique;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_categories_primary_unique
  ON public.restaurant_categories (restaurant_id, source, managed_by)
  WHERE is_primary = true;

COMMENT ON CONSTRAINT restaurant_business_details_restaurant_source_managed_unique
ON public.restaurant_business_details
IS 'Allows a GBP provider business-details snapshot and a Nabatable-managed business-details row to coexist for the same restaurant.';

COMMENT ON CONSTRAINT restaurant_phone_numbers_unique
ON public.restaurant_phone_numbers
IS 'Allows provider snapshots and Nabatable-managed phone numbers to coexist even when the normalized phone value matches.';

COMMENT ON CONSTRAINT restaurant_links_unique
ON public.restaurant_links
IS 'Allows provider snapshots and Nabatable-managed links to coexist even when the URL matches.';

COMMENT ON INDEX public.restaurant_addresses_primary_unique
IS 'Allows one primary address per restaurant/source/manager pair.';

COMMENT ON INDEX public.restaurant_phone_numbers_primary_unique
IS 'Allows one primary phone number per restaurant/source/manager pair.';

COMMENT ON INDEX public.restaurant_links_primary_unique
IS 'Allows one primary link per restaurant/link type/status/source/manager pair.';

COMMENT ON INDEX public.restaurant_categories_primary_unique
IS 'Allows one primary category per restaurant/source/manager pair.';

COMMIT;
