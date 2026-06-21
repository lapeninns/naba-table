BEGIN;

-- Email-keyed suppression list backing one-click List-Unsubscribe (RFC 8058) and
-- Resend bounce/complaint feedback. Keyed by normalized email (not profile id) so it
-- honours recipients who book without an account, not just registered profiles.
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('one_click', 'complaint', 'bounce', 'manual')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_unsubscribes_created_idx
  ON public.email_unsubscribes (created_at DESC);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_unsubscribes FROM anon;
REVOKE ALL ON TABLE public.email_unsubscribes FROM authenticated;
GRANT ALL ON TABLE public.email_unsubscribes TO service_role;

DROP POLICY IF EXISTS "Service role can manage email unsubscribes"
  ON public.email_unsubscribes;
CREATE POLICY "Service role can manage email unsubscribes"
  ON public.email_unsubscribes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.email_unsubscribes IS
  'Email-keyed suppression list for one-click List-Unsubscribe and Resend bounce/complaint feedback. Checked at send time.';

NOTIFY pgrst, 'reload schema';

COMMIT;
