-- Restaurant-scoped dual-sync controls for operator pause/resume.
-- Global env flags remain the deployment-level kill switches; this table
-- lets ops pause one venue while preserving read-only state inspection.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_restaurant_controls (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  sync_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  paused_by_user_id uuid,
  paused_at timestamptz,
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (restaurant_id, provider),
  CONSTRAINT dual_sync_restaurant_controls_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_restaurant_controls_pause_reason_check
    CHECK (pause_reason IS NULL OR length(trim(pause_reason)) <= 500)
);

CREATE INDEX IF NOT EXISTS dual_sync_restaurant_controls_paused_idx
  ON public.dual_sync_restaurant_controls (provider, sync_paused, updated_at DESC)
  WHERE sync_paused = true;

DROP TRIGGER IF EXISTS dual_sync_restaurant_controls_updated_at
  ON public.dual_sync_restaurant_controls;

CREATE TRIGGER dual_sync_restaurant_controls_updated_at
  BEFORE UPDATE ON public.dual_sync_restaurant_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.dual_sync_restaurant_controls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_restaurant_controls'
      AND policyname = 'Service role can manage dual sync restaurant controls'
  ) THEN
    CREATE POLICY "Service role can manage dual sync restaurant controls"
      ON public.dual_sync_restaurant_controls
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_restaurant_controls IS
  'Restaurant-scoped dual-sync pause/resume controls. Paused restaurants remain readable but write-affecting sync paths fail closed.';

COMMIT;
