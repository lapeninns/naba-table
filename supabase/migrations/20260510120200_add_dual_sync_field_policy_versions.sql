-- Durable field-policy version snapshots for unified dual-sync.
-- These rows record policy metadata hashes used for rollout audit and
-- troubleshooting without storing field values or function bodies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_field_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  version_label text NOT NULL,
  policy_hash text NOT NULL,
  policy_snapshot jsonb NOT NULL,
  field_count integer NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_by_user_id uuid,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_field_policy_versions_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_field_policy_versions_field_count_check
    CHECK (field_count >= 0)
);

CREATE INDEX IF NOT EXISTS dual_sync_field_policy_versions_restaurant_created_idx
  ON public.dual_sync_field_policy_versions (restaurant_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_field_policy_versions_hash_idx
  ON public.dual_sync_field_policy_versions (provider, policy_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_field_policy_versions_active_idx
  ON public.dual_sync_field_policy_versions (restaurant_id, provider, active, created_at DESC)
  WHERE active = true;

ALTER TABLE public.dual_sync_field_policy_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_field_policy_versions'
      AND policyname = 'Service role can manage dual sync field policy versions'
  ) THEN
    CREATE POLICY "Service role can manage dual sync field policy versions"
      ON public.dual_sync_field_policy_versions
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_field_policy_versions IS
  'Durable dual-sync field policy manifests. Rows store policy metadata hashes for rollout audit and drift troubleshooting; they do not store field values or executable registry functions.';

COMMIT;
