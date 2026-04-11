-- Migration: manager_daily_summary_sms_cutover
-- Purpose:
--   1. Add a canonical restaurant-profile toggle for the daily manager SMS summary.
--   2. Backfill it from the legacy WhatsApp settings row when present.
--   3. Retire the legacy transport-specific settings table now that SMS is the only supported path.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS manager_daily_summary_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.manager_daily_summary_enabled IS
  'Whether the manager should receive the daily booking summary by SMS at 10:00 local restaurant time.';

UPDATE public.restaurants AS restaurants
SET manager_daily_summary_enabled = COALESCE(settings.enabled, false)
FROM public.restaurant_whatsapp_summary_settings AS settings
WHERE settings.restaurant_id = restaurants.id
  AND restaurants.manager_daily_summary_enabled = false;

DROP TRIGGER IF EXISTS restaurant_whatsapp_summary_settings_updated_at
  ON public.restaurant_whatsapp_summary_settings;

DROP FUNCTION IF EXISTS public.touch_restaurant_whatsapp_summary_settings_updated_at();

DROP TABLE IF EXISTS public.restaurant_whatsapp_summary_settings;
