-- Adds the logical restaurant/provider lock used by unified dual-sync
-- refresh, publish, and auto-export jobs. One held lock is allowed per
-- restaurant/provider so read-only state calls can continue while write
-- affecting sync jobs are serialized.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  job_kind text NOT NULL,
  holder_id text NOT NULL,
  status text NOT NULL DEFAULT 'held',
  acquired_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_locks_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_locks_job_kind_check
    CHECK (job_kind IN (
      'google_refresh_manual',
      'google_refresh_scheduled',
      'google_refresh_location_link',
      'core_write_recompute',
      'publish_batch',
      'auto_export',
      'mirror_refresh_after_publish'
    )),
  CONSTRAINT dual_sync_locks_status_check
    CHECK (status IN ('held', 'released', 'expired')),
  CONSTRAINT dual_sync_locks_expires_after_acquire_check
    CHECK (expires_at > acquired_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_locks_one_held_per_restaurant_idx
  ON public.dual_sync_locks (restaurant_id, provider)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS dual_sync_locks_restaurant_status_idx
  ON public.dual_sync_locks (restaurant_id, provider, status, acquired_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_locks_expiry_idx
  ON public.dual_sync_locks (status, expires_at)
  WHERE status = 'held';

DROP TRIGGER IF EXISTS dual_sync_locks_updated_at
  ON public.dual_sync_locks;

CREATE TRIGGER dual_sync_locks_updated_at
  BEFORE UPDATE ON public.dual_sync_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.dual_sync_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_locks'
      AND policyname = 'Service role can manage dual sync locks'
  ) THEN
    CREATE POLICY "Service role can manage dual sync locks"
      ON public.dual_sync_locks
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_locks IS
  'Logical write-affecting dual-sync lock. At most one held lock per (restaurant, provider) serializes refresh, publish, auto-export, and mirror refresh work while allowing read-only state calls.';

COMMIT;
