-- Migration: add_restaurant_whatsapp_summary_settings
-- Purpose:
--   Add a service-role managed restaurant-level configuration table for the
--   daily WhatsApp booking summary Cloudflare worker.

CREATE TABLE IF NOT EXISTS public.restaurant_whatsapp_summary_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  recipient_e164 text NOT NULL,
  send_local_time time NOT NULL DEFAULT '10:00:00'::time,
  content_sid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.restaurant_whatsapp_summary_settings
  DROP CONSTRAINT IF EXISTS restaurant_whatsapp_summary_settings_recipient_e164_check;
ALTER TABLE public.restaurant_whatsapp_summary_settings
  ADD CONSTRAINT restaurant_whatsapp_summary_settings_recipient_e164_check
  CHECK (recipient_e164 ~ '^\+[1-9][0-9]{6,14}$');

ALTER TABLE public.restaurant_whatsapp_summary_settings
  DROP CONSTRAINT IF EXISTS restaurant_whatsapp_summary_settings_content_sid_check;
ALTER TABLE public.restaurant_whatsapp_summary_settings
  ADD CONSTRAINT restaurant_whatsapp_summary_settings_content_sid_check
  CHECK (char_length(trim(content_sid)) > 0);

CREATE INDEX IF NOT EXISTS restaurant_whatsapp_summary_settings_enabled_idx
  ON public.restaurant_whatsapp_summary_settings (enabled, send_local_time, restaurant_id);

CREATE OR REPLACE FUNCTION public.touch_restaurant_whatsapp_summary_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_whatsapp_summary_settings_updated_at
  ON public.restaurant_whatsapp_summary_settings;
CREATE TRIGGER restaurant_whatsapp_summary_settings_updated_at
  BEFORE UPDATE ON public.restaurant_whatsapp_summary_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_whatsapp_summary_settings_updated_at();

ALTER TABLE public.restaurant_whatsapp_summary_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.restaurant_whatsapp_summary_settings FROM authenticated;
REVOKE ALL ON TABLE public.restaurant_whatsapp_summary_settings FROM anon;
GRANT ALL ON TABLE public.restaurant_whatsapp_summary_settings TO service_role;

DROP POLICY IF EXISTS "Service role has full access to restaurant_whatsapp_summary_settings"
  ON public.restaurant_whatsapp_summary_settings;
CREATE POLICY "Service role has full access to restaurant_whatsapp_summary_settings"
  ON public.restaurant_whatsapp_summary_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.restaurant_whatsapp_summary_settings IS
  'Per-restaurant configuration for the Cloudflare-driven daily WhatsApp booking summary.';
