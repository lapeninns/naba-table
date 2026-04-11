-- Migration: add_manager_notification_phone
-- Purpose:
--   Store the manager's daily-summary delivery number on the restaurant profile
--   so operators can update it in-product without direct edits to the transport-
--   specific WhatsApp summary settings table.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS manager_notification_phone text;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_manager_notification_phone_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_manager_notification_phone_check
  CHECK (
    manager_notification_phone IS NULL
    OR manager_notification_phone ~ '^\+[1-9][0-9]{6,14}$'
  );

COMMENT ON COLUMN public.restaurants.manager_notification_phone IS
  'Manager delivery number used for daily booking summaries and future direct notification channels.';

UPDATE public.restaurants AS restaurants
SET manager_notification_phone = settings.recipient_e164
FROM public.restaurant_whatsapp_summary_settings AS settings
WHERE settings.restaurant_id = restaurants.id
  AND restaurants.manager_notification_phone IS NULL;
