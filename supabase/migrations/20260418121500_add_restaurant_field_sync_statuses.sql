BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_field_sync_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity_table text NOT NULL,
  entity_key text NOT NULL,
  field_key text NOT NULL,
  provider_record_id text,
  sync_status text NOT NULL DEFAULT 'synced',
  is_verified boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  verified_by text,
  last_provider_value_json jsonb,
  last_canonical_value_json jsonb,
  value_hash text,
  last_synced_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_field_sync_statuses_provider_check
    CHECK (provider IN ('gbp')),
  CONSTRAINT restaurant_field_sync_statuses_sync_status_check
    CHECK (sync_status IN ('synced', 'drifted', 'manual_override', 'pending_review')),
  CONSTRAINT restaurant_field_sync_statuses_verified_by_check
    CHECK (verified_by IS NULL OR verified_by IN ('gbp_sync', 'user', 'system')),
  CONSTRAINT restaurant_field_sync_statuses_unique
    UNIQUE (restaurant_id, provider, entity_table, entity_key, field_key)
);

CREATE INDEX IF NOT EXISTS restaurant_field_sync_statuses_lookup_idx
  ON public.restaurant_field_sync_statuses (restaurant_id, provider, entity_table, entity_key);

DROP TRIGGER IF EXISTS restaurant_field_sync_statuses_updated_at
ON public.restaurant_field_sync_statuses;

CREATE TRIGGER restaurant_field_sync_statuses_updated_at
  BEFORE UPDATE ON public.restaurant_field_sync_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_field_sync_statuses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_field_sync_statuses'
      AND policyname = 'Service role can manage restaurant field sync statuses'
  ) THEN
    CREATE POLICY "Service role can manage restaurant field sync statuses"
      ON public.restaurant_field_sync_statuses
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.restaurant_field_sync_statuses IS 'Field-level sync and verification metadata for canonical restaurant business-information values sourced from external providers such as GBP.';

COMMIT;
